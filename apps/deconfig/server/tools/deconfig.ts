/**
 * DECONFIG-related tools for namespace and file operations.
 *
 * This file contains all tools related to DECONFIG operations including:
 * - Namespace CRUD: create, read, list, delete
 * - File CRUD: put, read, delete, list
 * - Advanced operations: diff, watch, transactional writes
 *
 * Namespaces are now managed via workspace database for better scalability
 * and workspace-level isolation. Each namespace can contain files managed
 * by the existing Durable Object infrastructure.
 */
import { createTool } from "@deco/workers-runtime/mastra";
import { MergeStrategy, NamespaceId } from "../src/namespace.ts";
import { newNamespacesCRUD } from "../src/namespaces-db.ts";
import { z } from "zod";
import type { Env } from "../main.ts";

// Helper function to get workspace from env
const projectFor = (env: Env): string => {
  const workspace = env.DECO_CHAT_REQUEST_CONTEXT?.workspace;
  if (!workspace) {
    throw new Error("No workspace context available");
  }
  return workspace;
};

// Helper function to get namespace RPC (using namespaceName directly for performance)
const namespaceRpcFor = async (env: Env, namespaceName: string = "main") => {
  const projectId = projectFor(env);

  // Get or create the Durable Object for file operations
  const namespaceStub = env.NAMESPACE.get(
    env.NAMESPACE.idFromName(NamespaceId.build(namespaceName, projectId)),
  );

  const rpc = await namespaceStub.new({
    projectId,
    namespaceName,
  });

  return rpc;
};

// =============================================================================
// NAMESPACE CRUD OPERATIONS
// =============================================================================

export const createNamespaceTool = (env: Env) =>
  createTool({
    id: "CREATE_NAMESPACE",
    description:
      "Create a DECONFIG namespace. If sourceNamespace is provided, creates a branch from that namespace (O(1) operation). Otherwise creates an empty namespace.",
    inputSchema: z.object({
      namespaceName: z.string().describe("The name of the namespace to create"),
      sourceNamespace: z
        .string()
        .optional()
        .describe(
          "The source namespace to branch from (optional - creates empty namespace if not provided)",
        ),
      metadata: z
        .record(z.any())
        .optional()
        .describe("Optional metadata for the namespace"),
    }),
    outputSchema: z.object({
      namespaceName: z.string(),
      sourceNamespace: z.string().optional(),
      createdAt: z.number(),
    }),
    execute: async ({ context }) => {
      const crud = newNamespacesCRUD(env);

      // Check if namespace already exists
      if (await crud.namespaceExists(context.namespaceName)) {
        throw new Error(`Namespace '${context.namespaceName}' already exists`);
      }

      if (context.sourceNamespace) {
        // Branching from existing namespace
        if (!(await crud.namespaceExists(context.sourceNamespace))) {
          throw new Error(
            `Source namespace '${context.sourceNamespace}' not found`,
          );
        }

        // Branch from existing namespace using Durable Object
        const sourceRpc = await namespaceRpcFor(env, context.sourceNamespace);
        using _ = await sourceRpc.branch(context.namespaceName);
      }
      // Create empty namespace
      const namespace = await crud.createNamespace({
        name: context.namespaceName,
        metadata: context.metadata,
        origin_namespace: context.sourceNamespace,
      });

      return {
        namespaceName: context.namespaceName,
        sourceNamespace: context.sourceNamespace,
        createdAt: namespace.created_at,
      };
    },
  });

export const createListNamespacesTool = (env: Env) =>
  createTool({
    id: "LIST_NAMESPACES",
    description: "List all namespaces in the current workspace",
    inputSchema: z.object({
      prefix: z
        .string()
        .optional()
        .describe("Optional prefix to filter namespace names"),
    }),
    outputSchema: z.object({
      namespaces: z.array(
        z.object({
          name: z.string(),
          createdAt: z.number(),
          metadata: z.record(z.any()),
          originNamespace: z.string().nullable(),
        }),
      ),
      count: z.number(),
    }),
    execute: async ({ context }) => {
      const crud = newNamespacesCRUD(env);
      const namespaces = await crud.listNamespaces({ prefix: context.prefix });

      const formattedNamespaces = namespaces.map((ns) => ({
        name: ns.name,
        createdAt: ns.created_at,
        metadata: ns.metadata,
        originNamespace: ns.origin_namespace,
      }));

      return {
        namespaces: formattedNamespaces,
        count: formattedNamespaces.length,
      };
    },
  });

export const createDeleteNamespaceTool = (env: Env) =>
  createTool({
    id: "DELETE_NAMESPACE",
    description:
      "Delete a namespace and all its files. This operation cannot be undone.",
    inputSchema: z.object({
      namespaceName: z.string().describe("The name of the namespace to delete"),
    }),
    outputSchema: z.object({
      deleted: z.boolean(),
      namespaceName: z.string(),
      filesDeleted: z.number().optional(),
    }),
    execute: async ({ context }) => {
      const crud = newNamespacesCRUD(env);

      // Check if namespace exists
      if (!(await crud.namespaceExists(context.namespaceName))) {
        throw new Error(`Namespace '${context.namespaceName}' not found`);
      }

      // Get file count before deletion (optional)
      let filesDeleted = 0;
      try {
        const namespaceRpc = await namespaceRpcFor(env, context.namespaceName);
        filesDeleted = await namespaceRpc.softDelete();
      } catch (error) {
        // Ignore errors getting file count
      }

      // Delete from database
      const deleted = await crud.deleteNamespace(context.namespaceName);

      return {
        deleted,
        namespaceName: context.namespaceName,
        filesDeleted,
      };
    },
  });

export const createMergeNamespaceTool = (env: Env) =>
  createTool({
    id: "MERGE_NAMESPACE",
    description:
      "Merge another namespace into the current one with configurable strategy",
    inputSchema: z.object({
      targetNamespace: z
        .string()
        .optional()
        .default("main")
        .describe("The namespace to merge into (defaults to 'main')"),
      sourceNamespace: z.string().describe("The namespace to merge from"),
      strategy: z
        .enum(["OVERRIDE", "LAST_WRITE_WINS"])
        .describe("Merge strategy"),
    }),
    outputSchema: z.object({
      filesMerged: z.number(),
      added: z.array(z.string()),
      modified: z.array(z.string()),
      deleted: z.array(z.string()),
      conflicts: z
        .array(
          z.object({
            path: z.string(),
            resolved: z.enum(["local", "remote"]),
            localMtime: z.number(),
            remoteMtime: z.number(),
          }),
        )
        .optional(),
    }),
    execute: async ({ context }) => {
      const targetRpc = await namespaceRpcFor(env, context.targetNamespace);
      const result = await targetRpc.merge(
        context.sourceNamespace,
        context.strategy as MergeStrategy,
      );

      if (!result.success) {
        throw new Error("Merge operation failed");
      }

      return {
        filesMerged: result.filesMerged,
        added: result.added,
        modified: result.modified,
        deleted: result.deleted,
        conflicts: result.conflicts?.map((c: any) => ({
          path: c.path,
          resolved: c.resolved,
          localMtime: c.localMetadata.mtime,
          remoteMtime: c.remoteMetadata.mtime,
        })),
      };
    },
  });

export const createDiffNamespaceTool = (env: Env) =>
  createTool({
    id: "DIFF_NAMESPACE",
    description: "Compare two namespaces and get the differences",
    inputSchema: z.object({
      baseNamespace: z
        .string()
        .optional()
        .default("main")
        .describe("The base namespace to compare from (defaults to 'main')"),
      compareNamespace: z.string().describe("The namespace to compare against"),
    }),
    outputSchema: z.object({
      differences: z.array(
        z.object({
          path: z.string(),
          type: z.enum(["added", "modified", "deleted"]),
          baseAddress: z.string().optional(),
          compareAddress: z.string().optional(),
        }),
      ),
    }),
    execute: async ({ context }) => {
      const baseRpc = await namespaceRpcFor(env, context.baseNamespace);
      const diffs = await baseRpc.diff(context.compareNamespace);

      const differences = diffs.map((diff: any) => ({
        path: diff.path,
        type: (diff.metadata === null ? "deleted" : "modified") as
          | "added"
          | "modified"
          | "deleted",
        compareAddress: diff.metadata?.address,
      }));

      return { differences };
    },
  });

// =============================================================================
// FILE CRUD OPERATIONS (using namespaceName directly for performance)
// =============================================================================

const BaseFileOperationInputSchema = z.object({
  namespace: z
    .string()
    .optional()
    .default("main")
    .describe("The namespace name (defaults to 'main')"),
  path: z.string().describe("The file path within the namespace"),
});

export const createPutFileTool = (env: Env) =>
  createTool({
    id: "PUT_FILE",
    description:
      "Put a file in a DECONFIG namespace (create or update) with optional conflict detection",
    inputSchema: BaseFileOperationInputSchema.extend({
      content: z
        .string()
        .describe("The file content (will be base64 decoded if needed)"),
      metadata: z
        .record(z.any())
        .optional()
        .describe("Additional metadata key-value pairs"),
      expectedCtime: z
        .number()
        .optional()
        .describe("Expected change time for conflict detection"),
    }),
    outputSchema: z.object({
      conflict: z.boolean().optional(),
    }),
    execute: async ({ context }) => {
      // Convert content to ArrayBuffer
      let data: ArrayBuffer;
      try {
        // Try to decode as base64 first
        data = Uint8Array.from(atob(context.content), (c: string) =>
          c.charCodeAt(0),
        ).buffer;
      } catch {
        // If not base64, treat as regular string
        data = new TextEncoder().encode(context.content).buffer;
      }

      using namespaceRpc = await namespaceRpcFor(env, context.namespace);

      // Use transactional write (works for both conditional and unconditional writes)
      const result = await namespaceRpc.transactionalWrite({
        patches: [
          {
            path: context.path,
            content: data,
            metadata: context.metadata,
            expectedCtime: context.expectedCtime, // undefined if no conflict detection needed
          },
        ],
      });

      const fileResult = result.results[context.path];

      return {
        conflict: fileResult?.success ?? false,
      };
    },
  });

export const createReadFileTool = (env: Env) =>
  createTool({
    id: "READ_FILE",
    description: "Read a file from a DECONFIG namespace",
    inputSchema: BaseFileOperationInputSchema,
    outputSchema: z.object({
      content: z.string().describe("File content (base64 encoded)"),
      address: z.string(),
      metadata: z.record(z.string(), z.any()),
      mtime: z.number(),
      ctime: z.number(),
    }),
    execute: async ({ context }) => {
      using namespaceRpc = await namespaceRpcFor(env, context.namespace);
      const fileData = await namespaceRpc.getFile(context.path);

      if (!fileData) {
        throw new Error(`File not found: ${context.path}`);
      }

      // Convert ReadableStream to base64
      const reader = fileData.stream.getReader();
      const chunks: Uint8Array[] = [];
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          chunks.push(value);
        }
      }

      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      const content = btoa(String.fromCharCode(...combined));

      return {
        content,
        address: fileData.metadata.address,
        // @ts-ignore - TODO: fix this
        metadata: fileData.metadata.metadata,
        mtime: fileData.metadata.mtime,
        ctime: fileData.metadata.ctime,
      };
    },
  });

export const createDeleteFileTool = (env: Env) =>
  createTool({
    id: "DELETE_FILE",
    description: "Delete a file from a DECONFIG namespace",
    inputSchema: BaseFileOperationInputSchema,
    outputSchema: z.object({
      deleted: z.boolean(),
    }),
    execute: async ({ context }) => {
      using namespaceRpc = await namespaceRpcFor(env, context.namespace);
      return { deleted: await namespaceRpc.deleteFile(context.path) };
    },
  });

const ListFilesOutputSchema = z.object({
  files: z.record(
    z.string(),
    z.object({
      address: z.string(),
      metadata: z.record(z.string(), z.any()),
      sizeInBytes: z.number(),
      mtime: z.number(),
      ctime: z.number(),
    }),
  ),
  count: z.number(),
});

export const createListFilesTool = (env: Env) =>
  createTool({
    id: "LIST_FILES",
    description:
      "List files in a DECONFIG namespace with optional prefix filtering",
    inputSchema: BaseFileOperationInputSchema.omit({ path: true }).extend({
      prefix: z.string().optional().describe("Optional prefix to filter files"),
    }),
    outputSchema: ListFilesOutputSchema,
    execute: async ({ context }) => {
      using namespaceRpc = await namespaceRpcFor(env, context.namespace);

      const files = await namespaceRpc.getFiles(context.prefix);

      return {
        files,
        count: Object.keys(files).length,
      } as z.infer<typeof ListFilesOutputSchema>;
    },
  });

// Export all DECONFIG-related tools
export const deconfigTools = [
  // Namespace CRUD
  createNamespaceTool,
  createListNamespacesTool,
  createDeleteNamespaceTool,
  createMergeNamespaceTool,
  createDiffNamespaceTool,

  // File CRUD
  createPutFileTool,
  createReadFileTool,
  createDeleteFileTool,
  createListFilesTool,
];

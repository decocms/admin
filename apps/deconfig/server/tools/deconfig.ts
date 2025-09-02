/**
 * DECONFIG-related tools for namespace and file operations.
 *
 * This file contains all tools related to DECONFIG operations including:
 * - Namespace CRUD: create, read, branch, merge, delete
 * - File CRUD: put, read, delete, list
 * - Advanced operations: diff, watch, transactional writes
 *
 * Namespaces are lazily created - they exist as empty when first accessed.
 * Use DECONFIG_CREATE_NAMESPACE only when you need explicit configuration.
 * Default namespace is "main" when not specified.
 */
import { createTool } from "@deco/workers-runtime/mastra";
import { z } from "zod";
import type { Env } from "../main.ts";

// Helper function to get workspace from env
const getWorkspace = (env: Env): string => {
  const workspace = env.DECO_CHAT_REQUEST_CONTEXT?.workspace;
  if (!workspace) {
    throw new Error("No workspace context available");
  }
  return workspace;
};

// Helper function to get namespace RPC (lazy creation)
const getNamespaceRpc = async (
  env: Env,
  namespaceName: string = "main",
  pathPrefix?: string,
) => {
  const workspace = getWorkspace(env);
  const namespaceId = `${workspace}-${namespaceName}`;
  const namespaceStub = env.NAMESPACE.get(
    env.NAMESPACE.idFromName(namespaceId),
  );

  const rpc = await namespaceStub.new({
    projectId: workspace,
    namespaceName,
    pathPrefix: pathPrefix || "",
  });
  return rpc;
};

// =============================================================================
// NAMESPACE CRUD OPERATIONS
// =============================================================================

export const createNamespaceTool = (env: Env) =>
  createTool({
    id: "DECONFIG_CREATE_NAMESPACE",
    description:
      "Explicitly create a DECONFIG namespace with initial configuration (optional - namespaces are created lazily)",
    inputSchema: z.object({
      namespaceName: z.string().describe("The name of the namespace to create"),
      pathPrefix: z
        .string()
        .optional()
        .describe(
          "Optional path prefix for scoped operations (e.g., '/src/', '/docs/')",
        ),
      origin: z
        .string()
        .optional()
        .describe("Origin namespace for tracking lineage"),
    }),
    outputSchema: z.object({
      namespaceName: z.string(),
      projectId: z.string(),
      pathPrefix: z.string(),
    }),
    execute: async ({ context }) => {
      const workspace = getWorkspace(env);
      const namespaceStub = env.NAMESPACE.get(
        env.NAMESPACE.idFromName(context.namespaceName),
      );

      using _ = await namespaceStub.new({
        projectId: workspace,
        namespaceName: context.namespaceName,
        origin: context.origin || null,
        pathPrefix: context.pathPrefix,
      });

      return {
        namespaceName: context.namespaceName,
        projectId: workspace,
        pathPrefix: context.pathPrefix || "",
      };
    },
  });

export const createBranchNamespaceTool = (env: Env) =>
  createTool({
    id: "DECONFIG_BRANCH_NAMESPACE",
    description:
      "Create a new namespace by branching from an existing one (O(1) operation)",
    inputSchema: z.object({
      sourceNamespace: z
        .string()
        .optional()
        .default("main")
        .describe("The source namespace to branch from (defaults to 'main')"),
      targetNamespace: z.string().describe("The new namespace name"),
      pathPrefix: z
        .string()
        .optional()
        .describe("Optional path prefix for the new namespace"),
    }),
    outputSchema: z.object({
      sourceNamespace: z.string(),
      targetNamespace: z.string(),
      origin: z.string(),
    }),
    execute: async ({ context }) => {
      const sourceRpc = await getNamespaceRpc(env, context.sourceNamespace);
      using _ = await sourceRpc.branch(context.targetNamespace);

      return {
        sourceNamespace: context.sourceNamespace || "main",
        targetNamespace: context.targetNamespace,
        origin: context.sourceNamespace || "main",
      };
    },
  });

export const createMergeNamespaceTool = (env: Env) =>
  createTool({
    id: "DECONFIG_MERGE_NAMESPACE",
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
      pathPrefix: z
        .string()
        .optional()
        .describe("Optional path prefix for scoped operations"),
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
      const targetRpc = await getNamespaceRpc(
        env,
        context.targetNamespace,
        context.pathPrefix,
      );
      const result = await targetRpc.merge(
        context.sourceNamespace,
        context.strategy as any,
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
    id: "DECONFIG_DIFF_NAMESPACE",
    description: "Compare two namespaces and get the differences",
    inputSchema: z.object({
      baseNamespace: z
        .string()
        .optional()
        .default("main")
        .describe("The base namespace to compare from (defaults to 'main')"),
      compareNamespace: z.string().describe("The namespace to compare against"),
      pathPrefix: z
        .string()
        .optional()
        .describe("Optional path prefix for scoped comparison"),
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
      const baseRpc = await getNamespaceRpc(
        env,
        context.baseNamespace,
        context.pathPrefix,
      );
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
// FILE CRUD OPERATIONS
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
    id: "DECONFIG_PUT_FILE",
    description:
      "Put a file in a DECONFIG namespace (create or update) with optional conflict detection",
    inputSchema: BaseFileOperationInputSchema.extend({
      content: z
        .string()
        .describe("The file content (will be base64 decoded if needed)"),
      userMetadata: z
        .record(z.any())
        .optional()
        .describe("Additional metadata key-value pairs"),
      expectedCtime: z
        .number()
        .optional()
        .describe("Expected change time for conflict detection"),
    }),
    outputSchema: z.object({
      address: z.string(),
      hash: z.string(),
      size: z.number(),
      mtime: z.number(),
      ctime: z.number(),
      conflict: z.boolean().optional(),
      conflictReason: z.string().optional(),
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

      using namespaceRpc = await getNamespaceRpc(env, context.namespace);

      if (context.expectedCtime) {
        // Use transactional write with conflict detection
        const result = await namespaceRpc.transactionalWrite({
          files: [
            {
              path: context.path,
              content: data,
              userMetadata: context.userMetadata,
              expectedCtime: context.expectedCtime,
            },
          ],
          deletions: [],
        });

        if (!result.success) {
          throw new Error("Transactional write failed");
        }

        const appliedFile = result.appliedFiles[0];
        const skippedFile = result.skippedFiles[0];

        if (skippedFile) {
          // Conflict detected - return current state
          const currentMetadata = await namespaceRpc.getFileMetadata(
            context.path,
          );
          return {
            address: currentMetadata?.address || "",
            hash: currentMetadata?.address.split(":")[2] || "",
            size: currentMetadata?.sizeInBytes || 0,
            mtime: currentMetadata?.mtime || 0,
            ctime: currentMetadata?.ctime || 0,
            conflict: true,
            conflictReason: skippedFile.reason,
          };
        }

        if (!appliedFile) {
          throw new Error("No file was applied in transactional write");
        }

        return {
          address: appliedFile.address,
          hash: appliedFile.address.split(":")[2],
          size: appliedFile.metadata.sizeInBytes,
          mtime: appliedFile.metadata.mtime,
          ctime: appliedFile.metadata.ctime,
          conflict: false,
        };
      } else {
        // Simple write without conflict detection
        const address = await namespaceRpc.writeFile(
          context.path,
          data,
          context.userMetadata,
        );
        const metadata = await namespaceRpc.getFileMetadata(context.path);

        if (!metadata) {
          throw new Error("Failed to retrieve file metadata after creation");
        }

        return {
          address,
          hash: address.split(":")[2], // Extract hash from address
          size: metadata.sizeInBytes,
          mtime: metadata.mtime,
          ctime: metadata.ctime,
          conflict: false,
        };
      }
    },
  });

export const createReadFileTool = (env: Env) =>
  createTool({
    id: "DECONFIG_READ_FILE",
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
      using namespaceRpc = await getNamespaceRpc(env, context.namespace);
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
    id: "DECONFIG_DELETE_FILE",
    description: "Delete a file from a DECONFIG namespace",
    inputSchema: BaseFileOperationInputSchema,
    outputSchema: z.object({
      deleted: z.boolean(),
    }),
    execute: async ({ context }) => {
      using namespaceRpc = await getNamespaceRpc(env, context.namespace);

      const existed = await namespaceRpc.hasFile(context.path);
      if (!existed) {
        throw new Error(`File not found: ${context.path}`);
      }

      await namespaceRpc.deleteFile(context.path);

      return { deleted: true };
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
    id: "DECONFIG_LIST_FILES",
    description:
      "List files in a DECONFIG namespace with optional prefix filtering",
    inputSchema: BaseFileOperationInputSchema.omit({ path: true }).extend({
      prefix: z.string().optional().describe("Optional prefix to filter files"),
    }),
    outputSchema: ListFilesOutputSchema,
    execute: async ({ context }) => {
      using namespaceRpc = await getNamespaceRpc(env, context.namespace);

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
  createBranchNamespaceTool,
  createMergeNamespaceTool,
  createDiffNamespaceTool,

  // File CRUD
  createPutFileTool,
  createReadFileTool,
  createDeleteFileTool,
  createListFilesTool,
];

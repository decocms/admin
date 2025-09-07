/**
 * Mesh-related tools for app installation management.
 *
 * This file contains all tools related to Mesh operations including:
 * - App Installation CRUD: create, read, update, delete, list
 * - MCP proxy management through installations
 *
 * App installations are stored in DECONFIG branches for persistence
 * and workspace-level isolation.
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

// Schema for MCP Connection (based on the API types)
const MCPConnectionSchema = z.union([
  z.object({
    type: z.literal("HTTP"),
    url: z.string(),
    token: z.string().optional(),
  }),
  z.object({
    type: z.literal("SSE"),
    url: z.string(),
    token: z.string().optional(),
    headers: z.record(z.string()).optional(),
  }),
  z.object({
    type: z.literal("Websocket"),
    url: z.string(),
    token: z.string().optional(),
  }),
  z.object({
    type: z.literal("Deco"),
    tenant: z.string(),
    token: z.string().optional(),
  }),
  z.object({
    type: z.literal("INNATE"),
    name: z.string(),
    workspace: z.string().optional(),
  }),
]);

// App Installation schema
const AppInstallationSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  connection: MCPConnectionSchema,
  metadata: z.record(z.any()).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

type AppInstallation = z.infer<typeof AppInstallationSchema>;

// Helper to get installation file path
const getInstallationPath = (installationId: string) => `/installations/${installationId}.json`;

// =============================================================================
// APP INSTALLATION CRUD OPERATIONS
// =============================================================================

export const createInstallAppTool = (env: Env) =>
  createTool({
    id: "INSTALL_APP",
    description: "Install a new MCP app to make it available through the mesh proxy",
    inputSchema: z.object({
      branch: z
        .string()
        .optional()
        .default("main")
        .describe("The branch name (defaults to 'main')"),
      id: z.string().describe("Unique identifier for the app installation"),
      name: z.string().describe("Display name for the app"),
      description: z.string().optional().describe("Description of the app"),
      icon: z.string().optional().describe("Icon URL for the app"),
      connection: MCPConnectionSchema.describe("MCP connection configuration"),
      metadata: z.record(z.any()).optional().describe("Additional metadata"),
    }),
    outputSchema: z.object({
      id: z.string(),
      name: z.string(),
      createdAt: z.number(),
    }),
    execute: async ({ context }) => {
      const workspace = getWorkspace(env);
      const now = Date.now();
      
      const installation: AppInstallation = {
        id: context.id,
        name: context.name,
        description: context.description,
        icon: context.icon,
        connection: context.connection,
        metadata: context.metadata,
        createdAt: now,
        updatedAt: now,
      };

      const path = getInstallationPath(context.id);
      const content = JSON.stringify(installation, null, 2);

      // Store in DECONFIG
      await env.DECONFIG.PUT_FILE({
        branch: context.branch,
        path,
        content: btoa(content),
        metadata: {
          type: "app_installation",
          workspace,
        },
      });

      return {
        id: installation.id,
        name: installation.name,
        createdAt: installation.createdAt,
      };
    },
  });

export const createGetAppInstallationTool = (env: Env) =>
  createTool({
    id: "GET_APP_INSTALLATION",
    description: "Get an app installation by ID",
    inputSchema: z.object({
      branch: z
        .string()
        .optional()
        .default("main")
        .describe("The branch name (defaults to 'main')"),
      id: z.string().describe("The installation ID"),
    }),
    outputSchema: AppInstallationSchema,
    execute: async ({ context }) => {
      const path = getInstallationPath(context.id);

      try {
        const fileData = await env.DECONFIG.READ_FILE({
          branch: context.branch,
          path,
        });

        const content = atob(fileData.content);
        const installation = JSON.parse(content);
        
        return AppInstallationSchema.parse(installation);
      } catch (error) {
        throw new Error(`App installation not found: ${context.id}`);
      }
    },
  });

export const createListAppInstallationsTool = (env: Env) =>
  createTool({
    id: "LIST_APP_INSTALLATIONS",
    description: "List all app installations in the mesh",
    inputSchema: z.object({
      branch: z
        .string()
        .optional()
        .default("main")
        .describe("The branch name (defaults to 'main')"),
    }),
    outputSchema: z.object({
      installations: z.array(AppInstallationSchema),
      count: z.number(),
    }),
    execute: async ({ context }) => {
      try {
        const files = await env.DECONFIG.LIST_FILES({
          branch: context.branch,
          prefix: "/installations/",
        });

        const installations: AppInstallation[] = [];

        for (const [path, fileInfo] of Object.entries(files.files)) {
          if (path.endsWith('.json')) {
            try {
              const fileData = await env.DECONFIG.READ_FILE({
                branch: context.branch,
                path,
              });

              const content = atob(fileData.content);
              const installation = JSON.parse(content);
              installations.push(AppInstallationSchema.parse(installation));
            } catch (error) {
              console.warn(`Failed to parse installation file ${path}:`, error);
            }
          }
        }

        // Sort by creation date (newest first)
        installations.sort((a, b) => b.createdAt - a.createdAt);

        return {
          installations,
          count: installations.length,
        };
      } catch (error) {
        // If no installations directory exists, return empty list
        return {
          installations: [],
          count: 0,
        };
      }
    },
  });

export const createUpdateAppInstallationTool = (env: Env) =>
  createTool({
    id: "UPDATE_APP_INSTALLATION",
    description: "Update an existing app installation",
    inputSchema: z.object({
      branch: z
        .string()
        .optional()
        .default("main")
        .describe("The branch name (defaults to 'main')"),
      id: z.string().describe("The installation ID"),
      name: z.string().optional().describe("Display name for the app"),
      description: z.string().optional().describe("Description of the app"),
      icon: z.string().optional().describe("Icon URL for the app"),
      connection: MCPConnectionSchema.optional().describe("MCP connection configuration"),
      metadata: z.record(z.any()).optional().describe("Additional metadata"),
    }),
    outputSchema: AppInstallationSchema,
    execute: async ({ context }) => {
      const path = getInstallationPath(context.id);

      // Get existing installation
      const fileData = await env.DECONFIG.READ_FILE({
        branch: context.branch,
        path,
      });

      const content = atob(fileData.content);
      const existing = JSON.parse(content);
      const existingInstallation = AppInstallationSchema.parse(existing);

      // Update with new values
      const updatedInstallation: AppInstallation = {
        ...existingInstallation,
        name: context.name ?? existingInstallation.name,
        description: context.description ?? existingInstallation.description,
        icon: context.icon ?? existingInstallation.icon,
        connection: context.connection ?? existingInstallation.connection,
        metadata: context.metadata ?? existingInstallation.metadata,
        updatedAt: Date.now(),
      };

      const updatedContent = JSON.stringify(updatedInstallation, null, 2);

      // Store updated installation
      await env.DECONFIG.PUT_FILE({
        branch: context.branch,
        path,
        content: btoa(updatedContent),
        metadata: {
          type: "app_installation",
          workspace: getWorkspace(env),
        },
      });

      return updatedInstallation;
    },
  });

export const createDeleteAppInstallationTool = (env: Env) =>
  createTool({
    id: "DELETE_APP_INSTALLATION",
    description: "Delete an app installation from the mesh",
    inputSchema: z.object({
      branch: z
        .string()
        .optional()
        .default("main")
        .describe("The branch name (defaults to 'main')"),
      id: z.string().describe("The installation ID"),
    }),
    outputSchema: z.object({
      deleted: z.boolean(),
      id: z.string(),
    }),
    execute: async ({ context }) => {
      const path = getInstallationPath(context.id);

      try {
        const deleted = await env.DECONFIG.DELETE_FILE({
          branch: context.branch,
          path,
        });

        return {
          deleted: deleted.deleted,
          id: context.id,
        };
      } catch (error) {
        throw new Error(`Failed to delete app installation: ${context.id}`);
      }
    },
  });

// Export all mesh-related tools
export const meshTools = [
  createInstallAppTool,
  createGetAppInstallationTool,
  createListAppInstallationsTool,
  createUpdateAppInstallationTool,
  createDeleteAppInstallationTool,
];

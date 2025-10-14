/**
 * Integration and registry management tools.
 *
 * This file contains all tools related to managing integrations and the registry:
 * - List installed tools/integrations
 * - List available tools for installation
 * - Manage API keys and authorizations
 */
import { createPrivateTool } from "@deco/workers-runtime/mastra";
import { proxyConnectionForId } from "@deco/workers-runtime";
import { z } from "zod";
import type { Env } from "../main.ts";

/**
 * List all installed integrations/tools in the current workspace
 */
export const createListInstalledToolsTool = (env: Env) =>
  createPrivateTool({
    id: "LIST_INSTALLED_INTEGRATIONS",
    description:
      "List all installed integrations and tools available in the current workspace",
    inputSchema: z.object({}),
    outputSchema: z.object({
      integrations: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          description: z.string().optional(),
          icon: z.string().optional(),
          access: z.any().optional(),
        }),
      ),
      success: z.boolean(),
    }),
    execute: async () => {
      try {
        const result = await env.INTEGRATIONS.INTEGRATIONS_LIST({});

        return {
          integrations: result.items || [],
          success: true,
        };
      } catch (error) {
        console.error("Error listing installed tools:", error);
        // Return empty list on error instead of throwing
        return {
          integrations: [],
          success: false,
        };
      }
    },
  });

/**
 * List all available apps/tools in the registry for installation
 */
export const createListAvailableToolsTool = (env: Env) =>
  createPrivateTool({
    id: "LIST_REGISTRY_APPS",
    description:
      "List all available tools and integrations that can be installed from the registry",
    inputSchema: z.object({
      search: z.string().optional(),
    }),
    outputSchema: z.object({
      apps: z.array(
        z.object({
          id: z.string(),
          workspace: z.string(),
          scopeId: z.string(),
          scopeName: z.string(),
          appName: z.string(),
          name: z.string(),
          description: z.string().optional(),
          icon: z.string().optional(),
          createdAt: z.string(),
        }),
      ),
      success: z.boolean(),
    }),
    execute: async ({ context }) => {
      try {
        const result = await env.REGISTRY.REGISTRY_LIST_PUBLISHED_APPS({
          search: context.search,
        });

        return {
          apps: result.apps || [],
          success: true,
        };
      } catch (error) {
        console.error("Error listing available tools:", error);
        // Return empty list on error instead of throwing
        return {
          apps: [],
          success: false,
        };
      }
    },
  });

/**
 * Get detailed information about a specific integration
 */
export const createGetIntegrationDetailsTool = (env: Env) =>
  createPrivateTool({
    id: "GET_INTEGRATION_DETAILS",
    description:
      "Get detailed information about a specific installed integration",
    inputSchema: z.object({
      integrationId: z.string(),
    }),
    outputSchema: z.object({
      integration: z.any().optional(),
      success: z.boolean(),
      error: z.string().optional(),
    }),
    execute: async ({ context }) => {
      try {
        const result = await env.INTEGRATIONS.INTEGRATIONS_GET({
          id: context.integrationId,
        });

        return {
          integration: result,
          success: true,
        };
      } catch (error) {
        console.error("Error getting integration details:", error);
        return {
          integration: undefined,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  });

/**
 * Get available scopes from the registry
 */
export const createListRegistryScopesTool = (env: Env) =>
  createPrivateTool({
    id: "LIST_REGISTRY_SCOPES",
    description: "List all available scopes in the registry",
    inputSchema: z.object({}),
    outputSchema: z.object({
      scopes: z.array(
        z.object({
          id: z.string(),
          scopeName: z.string(),
          workspace: z.string(),
          createdAt: z.string(),
          updatedAt: z.string(),
        }),
      ),
      success: z.boolean(),
    }),
    execute: async () => {
      try {
        const result = await env.REGISTRY.REGISTRY_LIST_SCOPES({});

        return {
          scopes: result.scopes || [],
          success: true,
        };
      } catch (error) {
        console.error("Error listing registry scopes:", error);
        return {
          scopes: [],
          success: false,
        };
      }
    },
  });

/**
 * Call a tool from an installed integration
 */
export const createCallIntegrationToolTool = (env: Env) =>
  createPrivateTool({
    id: "CALL_INTEGRATION_TOOL",
    description: "Call a specific tool from an installed integration",
    inputSchema: z.object({
      id: z.string().optional(),
      params: z.record(z.any()),
    }),
    outputSchema: z.object({
      result: z.any(),
      success: z.boolean(),
      error: z.string().optional(),
    }),
    execute: async ({ context }) => {
      try {
        const result = await env.INTEGRATIONS.INTEGRATIONS_CALL_TOOL({
          id: context.id,
          params: {
            name: "unknown", // Required by Object_15
            ...context.params,
          },
        });

        return {
          result,
          success: true,
        };
      } catch (error) {
        console.error("Error calling integration tool:", error);
        return {
          result: null,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  });

// Export all integration tools
export const integrationTools = [
  createListInstalledToolsTool,
  createListAvailableToolsTool,
  createGetIntegrationDetailsTool,
  createListRegistryScopesTool,
  createCallIntegrationToolTool,
];

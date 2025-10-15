/**
 * Integration and registry management tools.
 *
 * This file contains all tools related to managing integrations and the registry:
 * - List installed tools/integrations
 * - List available tools for installation
 * - Manage API keys and authorizations
 */
import { createPrivateTool } from "@deco/workers-runtime/mastra";
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
        console.log("Listing installed tools");
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
  createGetIntegrationDetailsTool,
  createCallIntegrationToolTool,
];

import { z } from "zod";
import { AppName } from "../../common/index.ts";
import { IntegrationSchema, type MCPConnection } from "../../index.ts";
import {
  assertHasLocator,
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import { createToolGroup } from "../index.ts";
import { listRegistryApps } from "../registry/api.ts";
import { getIntegration, listIntegrations } from "../integrations/api.ts";

const MARKETPLACE_PROVIDER = "marketplace";

// Helper function to get virtual installable integrations
// (Currently returns empty array, but structure is here for future use)
const virtualInstallableIntegrations = () => {
  return [] as Array<{
    id: string;
    name: string;
    group: string;
    description: string;
    icon: string;
    provider: string;
    connection: MCPConnection;
  }>;
};

const createMcpManagementTool = createToolGroup("MCPManagement", {
  name: "MCPManagement",
  description: "Manage MCP integrations and discover new ones.",
  icon: "https://assets.decocache.com/mcp/2ead84c2-2890-4d37-b61c-045f4760f2f7/Integration-Management.png",
});

/**
 * Read an installed MCP by ID
 */
export const readMcp = createMcpManagementTool({
  name: "DECO_RESOURCE_MCP_READ",
  description:
    "Read an installed MCP (integration) by ID. Returns the MCP details including its tools.",
  inputSchema: z.lazy(() =>
    z.object({
      id: z.string().describe("The ID of the MCP to read"),
    }),
  ),
  outputSchema: z.lazy(() =>
    IntegrationSchema.extend({
      tools: z
        .array(
          z.object({
            name: z.string(),
            description: z.string().optional(),
            inputSchema: z.any().optional(),
            outputSchema: z.any().optional(),
          }),
        )
        .nullable()
        .optional(),
    }),
  ),
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);
    assertHasLocator(c);

    // Use the existing getIntegration tool directly
    return await getIntegration.handler({ id }, c);
  },
});

/**
 * Search for MCPs in marketplace and installed
 * Returns integrations with an isInstalled flag
 */
export const searchMcps = createMcpManagementTool({
  name: "DECO_RESOURCE_MCP_STORE_SEARCH",
  description:
    "Search for MCPs in both marketplace and installed. Returns all results with an 'isInstalled' flag indicating which MCPs are already installed in your workspace.",
  inputSchema: z.lazy(() =>
    z.object({
      query: z
        .string()
        .describe(
          "The query to search for. Leave empty to get all installed MCPs",
        )
        .optional(),
      showContracts: z
        .boolean()
        .describe("Whether to show contracts")
        .optional()
        .default(false),
    }),
  ),
  outputSchema: z.lazy(() =>
    z.object({
      integrations: z
        .array(
          IntegrationSchema.omit({ connection: true, tools: true }).and(
            z.object({
              provider: z.string(),
              friendlyName: z.string().optional(),
              isInstalled: z
                .boolean()
                .describe(
                  "Whether this MCP is already installed in the workspace",
                ),
            }),
          ),
        )
        .describe("The MCPs that match the query"),
    }),
  ),
  handler: async ({ query, showContracts }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    // Get installed integrations
    const installedResult = await listIntegrations.handler({}, c);
    const installedIntegrations = installedResult.items || [];

    const installedIds = new Set(
      installedIntegrations.map((i) => i.id.toLowerCase()),
    );

    // Search marketplace
    const registry = await listRegistryApps.handler(
      {
        search: query,
      },
      c,
    );

    const registryList = registry.apps
      .map((app) => {
        if (!showContracts && appIsContract(app)) {
          return null;
        }
        const appId = AppName.build(app.scopeName, app.name);
        return {
          id: app.id,
          appName: appId,
          name: appId,
          friendlyName: app.friendlyName ?? undefined,
          description: app.description ?? undefined,
          icon: app.icon ?? undefined,
          provider: MARKETPLACE_PROVIDER,
          metadata: app.metadata
            ? (app.metadata as Record<string, unknown>)
            : undefined,
          verified: app.verified ?? undefined,
          createdAt: app.createdAt ?? undefined,
          isInstalled: installedIds.has(app.id.toLowerCase()),
        };
      })
      .filter((app) => app !== null);

    const virtualIntegrations = virtualInstallableIntegrations();
    const allIntegrations = [
      ...virtualIntegrations
        .filter(
          (integration) =>
            !query ||
            integration.name.toLowerCase().includes(query.toLowerCase()) ||
            (integration.description &&
              integration.description
                .toLowerCase()
                .includes(query.toLowerCase())),
        )
        .map((integration) => {
          const { connection: _connection, ...rest } = integration;
          return {
            ...rest,
            provider: "virtual",
            isInstalled: installedIds.has(integration.id.toLowerCase()),
          };
        }),
      ...registryList,
    ];

    // Mark installed integrations
    installedIntegrations.forEach((installed) => {
      const existing = allIntegrations.find(
        (i) => i.id.toLowerCase() === installed.id.toLowerCase(),
      );
      if (existing) {
        existing.isInstalled = true;
      } else {
        // Add installed integrations that aren't in marketplace
        // Only add if they match the query (by name or description)
        const matchesQuery =
          !query ||
          installed.name.toLowerCase().includes(query.toLowerCase()) ||
          (installed.description &&
            installed.description
              .toLowerCase()
              .includes(query.toLowerCase())) ||
          ((installed as { friendlyName?: string }).friendlyName &&
            (installed as { friendlyName?: string })
              .friendlyName!.toLowerCase()
              .includes(query.toLowerCase()));

        if (matchesQuery) {
          const { connection: _connection, tools: _tools, ...rest } = installed;
          allIntegrations.push({
            ...rest,
            appName: installed.appName ?? "",
            friendlyName:
              (installed as { friendlyName?: string }).friendlyName ??
              undefined,
            description: installed.description ?? undefined,
            icon: installed.icon ?? undefined,
            metadata: installed.metadata
              ? (installed.metadata as Record<string, unknown>)
              : undefined,
            verified: installed.verified ?? undefined,
            createdAt: installed.createdAt ?? "",
            provider: "installed",
            isInstalled: true,
          });
        }
      }
    });

    return {
      integrations: allIntegrations,
    };
  },
});

// Helper function to check if app is a contract
function appIsContract(app: {
  metadata?: Record<string, unknown> | null;
}): boolean {
  return app.metadata?.contract === true;
}

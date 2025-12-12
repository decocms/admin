import { Self } from "@/api/routes/management";
import { CreateConnectionInput } from "@/tools/connection/create";

export type McpConnectionProvider = (
  self: Awaited<ReturnType<typeof Self.forRequest>>,
) => Promise<CreateConnectionInput["data"]> | CreateConnectionInput["data"];

export const defaultOrgMcps: McpConnectionProvider[] = [
  // Deco Store
  () => ({
    title: "Deco Store",
    description: "Official deco MCP registry with curated integrations",
    connection_type: "HTTP",
    connection_url: "https://api.decocms.com/mcp/registry",
    icon: "https://assets.decocache.com/decocms/00ccf6c3-9e13-4517-83b0-75ab84554bb9/596364c63320075ca58483660156b6d9de9b526e.png",
    app_name: "deco-registry",
    app_id: null,
    connection_token: null,
    connection_headers: null,
    oauth_config: null,
    configuration_state: null,
    configuration_scopes: null,
    metadata: {
      isDefault: true,
      type: "registry",
    },
  }),
];

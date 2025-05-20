import type { Integration } from "@deco/sdk";
import type { AIAgent } from "../agent.ts";
import { createServerClient } from "../mcp.ts";

const DECO_REGISTRY_SERVER_URL = "https://mcp.deco.site";

export const getDecoRegistryServerClient = () => {
  const url = new URL("/mcp/messages", DECO_REGISTRY_SERVER_URL);

  return createServerClient({
    name: url.hostname,
    connection: { type: "HTTP", url: url.href },
  });
};

export const searchInstalledIntegations = async (
  agent: AIAgent,
  query?: string,
): Promise<Integration[]> => {
  const integrations = await agent.metadata?.mcpClient?.INTEGRATIONS_LIST({});

  const lower = query?.toLowerCase() ?? "";

  return (integrations ?? [])
    .filter((id): id is Integration => id !== null)
    .filter((integration) =>
      integration.name.toLowerCase().includes(lower) ||
      integration.description?.toLowerCase().includes(lower)
    );
};

export const searchMarketplaceIntegations = async (
  query?: string,
): Promise<(Integration & { provider: string })[]> => {
  const client = await getDecoRegistryServerClient();

  try {
    const result = await client.callTool({
      name: "SEARCH",
      arguments: { query },
    }) as { content: { text: string }[] };

    const list = JSON.parse(result.content[0].text) as (Integration & {
      provider: string;
    })[];

    return list;
  } finally {
    client.close();
  }
};

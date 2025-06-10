import { CallToolResultSchema, type Integration } from "@deco/sdk";
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
      // @ts-expect-error should be fixed after this is merged: https://github.com/modelcontextprotocol/typescript-sdk/pull/528
    }, CallToolResultSchema);

    return result.structuredContent as (Integration & { provider: string })[];
  } finally {
    client.close();
  }
};

export const startOauthFlow = async (
  appName: string,
  returnUrl: string,
  installId: string,
) => {
  const url = new URL(`${DECO_REGISTRY_SERVER_URL}/oauth/start`);
  url.searchParams.set("installId", installId);
  url.searchParams.set("appName", appName);
  url.searchParams.set("returnUrl", returnUrl);

  const response = await fetch(url.toString(), {
    redirect: "manual",
  });

  const redirectUrl = response.headers.get("location");

  if (!redirectUrl) {
    throw new Error("No redirect URL found");
  }

  return { redirectUrl };
};

export const startComposioOauthFlow = async (
  url: string,
) => {
  const client = await createServerClient({
    name: "composio-authenticator",
    connection: { type: "HTTP", url },
  });

  const {tools} = await client.listTools();

  const connectionCheckTool = tools.find((tool) => tool.name.endsWith("_CHECK_ACTIVE_CONNECTION"));
  const initiateConnectionTool = tools.find((tool) => tool.name.endsWith("_INITIATE_CONNECTION"));
  const getRequiredParametersTool = tools.find((tool) => tool.name.endsWith("_GET_REQUIRED_PARAMETERS"));
  
  if (!connectionCheckTool || !initiateConnectionTool || !getRequiredParametersTool) {
    throw new Error("Composio authenticator has no required tools");
  }

  const connectionCheckResult = await client.callTool({
    name: connectionCheckTool.name,
    arguments: {},
  });

  console.log("connection check result", connectionCheckResult);

  const getRequiredParametersResult = await client.callTool({
    name: getRequiredParametersTool.name,
    arguments: {},
  });

  console.log("get required parameters result", getRequiredParametersResult);

  const initiateConnectionResult = await client.callTool({
    name: initiateConnectionTool.name,
    arguments: {},
  });

  const thing = initiateConnectionResult.content?.[0]?.text ?? "{}"
  const thingParsed = JSON.parse(thing);
  console.log("initiate connection result", thingParsed);
  const redirectUrl = thingParsed.data.response_data.redirect_url ?? "";
  return { redirectUrl };
};
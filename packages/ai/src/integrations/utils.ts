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

interface ToolCallResult {
  content?: {
    text?: string;
  }[];
}

const parseComposioToolResult = (result: ToolCallResult) => {
  try {
    const dataStringified = result.content?.[0]?.text ?? "{}";
    const data = JSON.parse(dataStringified);
    return data;
  } catch (error) {
    console.error("Error parsing Composio tool result", error);
    return {};
  }
};

// TODO: Check if any composio integration cannot be auto connected
const canAutoConnect = (_data: Record<string, unknown>) => {
  console.log("[Composio] canAutoConnect", _data);
  return true;
};

export const startComposioOauthFlow = async (
  url: string,
) => {
  const client = await createServerClient({
    name: "composio-authenticator",
    connection: { type: "HTTP", url },
  });

  const { tools } = await client.listTools();

  const initiateConnectionTool = tools.find((tool) =>
    tool.name.endsWith("_INITIATE_CONNECTION")
  );
  const getRequiredParametersTool = tools.find((tool) =>
    tool.name.endsWith("_GET_REQUIRED_PARAMETERS")
  );

  if (!initiateConnectionTool) {
    throw new Error("Composio authenticator has no required tools");
  }

  if (getRequiredParametersTool) {
    const getRequiredParametersResult = await client.callTool({
      name: getRequiredParametersTool.name,
      arguments: {},
    });

    const getRequiredParametersData = parseComposioToolResult(
      getRequiredParametersResult as ToolCallResult,
    );

    if (!canAutoConnect(getRequiredParametersData)) {
      return { redirectUrl: null };
    }
  }

  const initiateConnectionResult = await client.callTool({
    name: initiateConnectionTool.name,
    arguments: {},
  });

  const data = parseComposioToolResult(
    initiateConnectionResult as ToolCallResult,
  );
  const redirectUrl = data.data?.response_data?.redirect_url ?? null;
  return { redirectUrl };
};

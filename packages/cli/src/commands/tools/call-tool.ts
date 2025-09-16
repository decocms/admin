import { getConfig } from "../../lib/config.js";
import { createWorkspaceClient } from "../../lib/mcp.js";
import process from "node:process";

interface CallToolOptions {
  integration: string;
  payload?: string;
  set?: string[];
  workspace?: string;
}

/**
 * Auto-completion function for integration IDs
 */
export async function autocompleteIntegrations(
  partial: string,
): Promise<string[]> {
  try {
    const config = await getConfig({}).catch(() => ({
      workspace: undefined,
      local: false,
    }));
    if (!config.workspace) return [];

    const client = await createWorkspaceClient({
      workspace: config.workspace,
      local: config.local,
    });

    const response = await client.callTool({
      name: "INTEGRATIONS_LIST",
      arguments: {},
    });

    if (response.isError || !response.structuredContent) return [];

    const integrations = (
      response.structuredContent as {
        items: Array<{ id: string; name: string }>;
      }
    )?.items || [];

    return integrations
      .map((integration) => integration.id)
      .filter((id) => id.toLowerCase().includes(partial.toLowerCase()))
      .sort();
  } catch {
    return [];
  }
}

/**
 * Auto-completion function for tool names based on selected integration
 */
export async function autocompleteTools(
  partial: string,
  options: { integration?: string },
): Promise<string[]> {
  try {
    if (!options.integration) return [];

    const config = await getConfig({}).catch(() => ({
      workspace: undefined,
      local: false,
    }));
    if (!config.workspace) return [];

    const client = await createWorkspaceClient({
      workspace: config.workspace,
      local: config.local,
      integrationId: options.integration,
    });

    const toolsResponse = await client.listTools();

    return toolsResponse.tools
      .map((tool) => tool.name)
      .filter((name) => name.toLowerCase().includes(partial.toLowerCase()))
      .sort();
  } catch {
    return [];
  }
}

/**
 * Parse --set arguments into an object
 * Example: ['x=1', 'y=hello', 'z.nested=value'] -> { x: '1', y: 'hello', z: { nested: 'value' } }
 */
function parseSetArguments(setArgs: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const arg of setArgs) {
    const equalIndex = arg.indexOf("=");
    if (equalIndex === -1) {
      throw new Error(
        `Invalid --set argument: ${arg}. Expected format: key=value`,
      );
    }

    const key = arg.slice(0, equalIndex);
    const value = arg.slice(equalIndex + 1);

    // Handle nested keys like "x.y.z"
    const keyParts = key.split(".");
    let current = result;

    for (let i = 0; i < keyParts.length - 1; i++) {
      const part = keyParts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    const finalKey = keyParts[keyParts.length - 1];
    // Try to parse as JSON, fall back to string
    try {
      current[finalKey] = JSON.parse(value);
    } catch {
      current[finalKey] = value;
    }
  }

  return result;
}

export async function callToolCommand(
  toolName: string,
  options: CallToolOptions,
): Promise<void> {
  try {
    // Get configuration
    const config = await getConfig({
      inlineOptions: { workspace: options.workspace },
    });

    // Check workspace configuration
    if (!config.workspace) {
      throw new Error("No workspace configured. Run 'deco configure' first.");
    }

    // Prepare payload
    let payload: Record<string, unknown> = {};

    if (options.payload) {
      try {
        payload = JSON.parse(options.payload);
      } catch (error) {
        throw new Error(
          `Invalid JSON payload: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    if (options.set && options.set.length > 0) {
      const setPayload = parseSetArguments(options.set);
      payload = { ...payload, ...setPayload };
    }

    // Create MCP client (workspace or integration-specific)
    const client = await createWorkspaceClient({
      workspace: config.workspace,
      local: config.local,
      integrationId: options.integration,
    });

    // Call the tool using MCP
    const response = await client.callTool({
      name: toolName,
      arguments: payload,
    });

    if (response.isError) {
      const errorMessage = Array.isArray(response.content)
        ? response.content.map((c) => c.text).join("\n")
        : "Unknown error occurred";
      throw new Error(errorMessage);
    }

    console.log(JSON.stringify(response.structuredContent, null, 2));
  } catch (error) {
    console.error(
      "❌ Tool call failed:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}

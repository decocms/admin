import { fetchAPI } from "../fetcher.ts";
import { type Integration, IntegrationSchema } from "../models/mcp.ts";

export class IntegrationNotFoundError extends Error {
  integrationId: string;

  constructor(integrationId: string) {
    super(`Integration ${integrationId} not found`);
    this.integrationId = integrationId;
  }
}

/**
 * Save an MCP to the file system
 * @param mcp - The MCP to save
 */
export const saveIntegration = async (context: string, mcp: Integration) => {
  const response = await fetchAPI({
    segments: [context, "integration"],
    method: "POST",
    body: JSON.stringify(mcp),
  });

  if (response.ok) {
    return response.json() as Promise<Integration>;
  }

  throw new Error("Failed to save integration");
};

/**
 * Create a new MCP
 * @returns The new MCP
 */
export const createIntegration = (
  context: string,
  template: Partial<Integration> = {},
) => {
  const mcp: Integration = {
    id: crypto.randomUUID(),
    name: "New Integration",
    description: "A new multi-channel platform integration",
    icon: "",
    connection: { type: "SSE", url: "https://example.com/sse" },
    ...template,
  };

  return saveIntegration(context, mcp);
};

/**
 * Load an MCP from the file system
 * @param mcpId - The id of the MCP to load
 * @returns The MCP
 */
export const loadIntegration = async (
  context: string,
  mcpId: string,
  signal?: AbortSignal,
): Promise<Integration> => {
  const response = await fetchAPI({
    segments: [context, "integration", mcpId],
    signal,
  });

  if (response.ok) {
    return response.json() as Promise<Integration>;
  }

  if (response.status === 404) {
    throw new IntegrationNotFoundError(mcpId);
  }

  throw new Error("Failed to load integration");
};

export const listIntegrations = async (
  context: string,
  signal?: AbortSignal,
) => {
  const response = await fetchAPI({
    segments: [context, "integrations"],
    signal,
  });

  if (response.ok) {
    return response.json() as Promise<{ items: Integration[] }>;
  }

  throw new Error("Failed to list integrations");
};

/**
 * Delete an MCP from the file system
 * @param mcpId - The id of the MCP to delete
 */
export const deleteIntegration = async (context: string, mcpId: string) => {
  const response = await fetchAPI({
    segments: [context, "integration", mcpId],
    method: "DELETE",
  });

  if (response.ok) {
    return response.json();
  }

  throw new Error("Failed to delete integration");
};

/**
 * Validate an MCP against the Zod schema
 *
 * @param mcp - The MCP to validate
 * @returns The validated MCP or an error
 */
export const validateIntegration = (
  mcp: unknown,
): [Integration, null] | [null, Error] => {
  try {
    const validatedMCP = IntegrationSchema.parse(mcp);
    return [validatedMCP, null];
  } catch (error) {
    return [null, error instanceof Error ? error : new Error("Invalid MCP")];
  }
};

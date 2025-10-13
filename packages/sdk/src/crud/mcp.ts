import { MCPClient } from "../fetcher.ts";
import {
  type Binder,
  type Integration,
  IntegrationSchema,
} from "../models/mcp.ts";
import { ProjectLocator } from "../locator.ts";

/**
 * Save an MCP to the file system
 * @param integration - The MCP to save
 */
export const saveIntegration = (
  locator: ProjectLocator,
  integration: Integration,
): Promise<Integration> =>
  MCPClient.forLocator(locator).INTEGRATIONS_UPDATE({
    id: integration.id,
    integration,
  }) as Promise<Integration>;

export type CreateIntegrationPayload = Partial<Integration> & {
  clientIdFromApp?: string;
};

/**
 * Create a new MCP
 * @returns The new MCP
 */
export const createIntegration = (
  locator: ProjectLocator,
  template: CreateIntegrationPayload = {},
): Promise<Integration> =>
  MCPClient.forLocator(locator).INTEGRATIONS_CREATE({
    id: crypto.randomUUID(),
    name: "New Integration",
    description: "A new multi-channel platform integration",
    icon: "",
    connection: { type: "HTTP", url: "https://example.com/mcp" },
    ...template,
  }) as Promise<Integration>;

/**
 * Load an MCP from the file system
 * @param mcpId - The id of the MCP to load
 * @returns The MCP
 */
export const loadIntegration = (
  locator: ProjectLocator,
  mcpId: string,
  signal?: AbortSignal,
): Promise<Integration> =>
  MCPClient.forLocator(locator).INTEGRATIONS_GET({ id: mcpId }, { signal });

export interface ListIntegrationsFilter {
  binder?: Binder;
}

export const listIntegrations = (
  locator: ProjectLocator,
  filter?: ListIntegrationsFilter,
  signal?: AbortSignal,
): Promise<Integration[]> =>
  MCPClient.forLocator(locator)
    .INTEGRATIONS_LIST({ binder: filter?.binder }, { signal })
    .then((res) => res.items);

/**
 * Delete an MCP from the file system
 * @param mcpId - The id of the MCP to delete
 */
export const deleteIntegration = (locator: ProjectLocator, mcpId: string) =>
  MCPClient.forLocator(locator).INTEGRATIONS_DELETE({
    id: mcpId,
  });

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

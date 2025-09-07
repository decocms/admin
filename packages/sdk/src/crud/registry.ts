import { MCPClient } from "../fetcher.ts";
import { ProjectLocator } from "../locator.ts";

/**
 * Get a registry app
 * @param locator - The workspace
 * @param params - Registry app parameters
 * @returns The registry app
 */
export const getRegistryApp = (
  locator: ProjectLocator,
  params: { name: string },
) => MCPClient.forLocator(locator).REGISTRY_GET_APP(params);

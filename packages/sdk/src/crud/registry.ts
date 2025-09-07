import { MCPClient } from "../fetcher.ts";

/**
 * Get a registry app
 * @param locator - The workspace
 * @param params - Registry app parameters
 * @returns The registry app
 */
export const getRegistryApp = (
  params: { name: string },
) => MCPClient.REGISTRY_GET_APP(params);

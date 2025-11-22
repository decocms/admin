import { MCPClient } from "../fetcher.ts";
import type { ProjectLocator } from "../locator.ts";

/**
 * Get a registry app
 * @param locator - The workspace
 * @param params - Registry app parameters
 * @returns The registry app
 */
export const getRegistryApp = (params: { name: string }) =>
  MCPClient.REGISTRY_GET_APP(params);

/**
 * Get the schema for a marketplace app
 * @param locator - The workspace
 * @param appName - The app name
 * @returns The app schema and scopes
 */
export const getMarketplaceAppSchema = (
  locator: ProjectLocator,
  appName: string,
) => MCPClient.forLocator(locator).DECO_GET_APP_SCHEMA({ appName });

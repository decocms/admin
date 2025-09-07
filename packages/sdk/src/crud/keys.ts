import { MCPClient } from "../fetcher.ts";
import { ProjectLocator } from "../locator.ts";

/**
 * Create an API key
 * @param locator - The workspace
 * @param params - API key parameters
 * @returns The created API key
 */
export const createAPIKey = (
  locator: ProjectLocator,
  params: {
    claims?: {
      appName: string;
      integrationId: string;
      state: unknown;
    };
    name: string;
    policies: Array<{ effect: "allow" | "deny"; resource: string }>;
  },
) => MCPClient.forLocator(locator).API_KEYS_CREATE(params);

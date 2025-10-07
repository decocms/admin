import { MCPClient } from "../fetcher.ts";
import { ProjectLocator } from "../locator.ts";

export interface ApiKeyClaims {
  appName: string;
  integrationId: string;
  state: unknown;
}

export type ApiKeyPolicies = Array<{
  effect: "allow" | "deny";
  resource: string;
}>;

/**
 * Create an API key
 * @param locator - The workspace
 * @param params - API key parameters
 * @returns The created API key
 */
export const createAPIKey = (
  locator: ProjectLocator,
  params: {
    claims?: ApiKeyClaims;
    name: string;
    policies: ApiKeyPolicies;
  },
) => MCPClient.forLocator(locator).API_KEYS_CREATE(params);

export const reissueAPIKey = (
  locator: ProjectLocator,
  params: {
    id: string;
    claims?: ApiKeyClaims;
    policies?: ApiKeyPolicies;
  },
) => MCPClient.forLocator(locator).API_KEYS_REISSUE(params);

export const getAPIKeyForIntegration = ({
  locator,
  integrationId,
}: {
  locator: ProjectLocator,
  integrationId: string,
}) => MCPClient.forLocator(locator).INTEGRATIONS_GET_API_KEY({ integrationId });

import { MCPClient } from "../fetcher.ts";
import { ProjectLocator } from "../locator.ts";
import { Statement } from "../models/index.ts";

export interface ApiKeyClaims {
  appName: string;
  integrationId: string;
  state: unknown;
}

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
    policies: Statement[];
  },
): Promise<{
  id: string;
  value: string;
  policies?: Statement[];
  [key: string]: unknown;
}> =>
  MCPClient.forLocator(locator).API_KEYS_CREATE(params) as Promise<{
    id: string;
    value: string;
    policies?: Statement[];
    [key: string]: unknown;
  }>;

export const reissueAPIKey = (
  locator: ProjectLocator,
  params: {
    id: string;
    claims?: ApiKeyClaims;
    policies?: Statement[];
  },
): Promise<{
  id: string;
  value: string;
  policies?: Statement[];
  [key: string]: unknown;
}> =>
  MCPClient.forLocator(locator).API_KEYS_REISSUE(params) as Promise<{
    id: string;
    value: string;
    policies?: Statement[];
    [key: string]: unknown;
  }>;

export const getAPIKeyForIntegration = ({
  locator,
  integrationId,
}: {
  locator: ProjectLocator;
  integrationId: string;
}): Promise<{
  id: string;
  value: string;
  policies?: Statement[];
  [key: string]: unknown;
}> =>
  MCPClient.forLocator(locator).INTEGRATIONS_GET_API_KEY({
    integrationId,
  }) as Promise<{
    id: string;
    value: string;
    policies?: Statement[];
    [key: string]: unknown;
  }>;

import { MCPClient } from "../fetcher.ts";
import type {
  CreateSecretInput,
  ListSecretsInput,
  UpdateSecretInput,
} from "../mcp/secrets/api.ts";
import { ProjectLocator } from "../locator.ts";

export interface Secret {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export const listSecrets = (
  locator: ProjectLocator,
  options: ListSecretsInput = {},
  init?: RequestInit,
) =>
  MCPClient.forLocator(locator)
    .SECRETS_LIST(options, init)
    .then((res) => res.items as Secret[]);

export const createSecret = (
  locator: ProjectLocator,
  input: CreateSecretInput,
  init?: RequestInit,
) => MCPClient.forLocator(locator).SECRETS_CREATE(input, init);

export const updateSecret = (
  locator: ProjectLocator,
  input: UpdateSecretInput,
  init?: RequestInit,
) => MCPClient.forLocator(locator).SECRETS_UPDATE(input, init);

export const deleteSecret = (
  locator: ProjectLocator,
  id: string,
  init?: RequestInit,
): Promise<{ success: boolean }> =>
  MCPClient.forLocator(locator).SECRETS_DELETE({ id }, init) as Promise<{
    success: boolean;
  }>;

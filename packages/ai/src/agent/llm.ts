import { isWellKnownModel } from "@deco/sdk";
import type { LLMVault } from "@deco/sdk/mcp";
import type { LanguageModelV1 } from "ai";
import { createLLMProvider } from "./llm-provider.ts";

export const DEFAULT_ACCOUNT_ID = "c95fc4cec7fc52453228d9db170c372c";
export const DEFAULT_GATEWAY_ID = "deco-ai";

export interface LLMConfig {
  model: string;
  bypassGateway?: boolean;
  bypassOpenRouter?: boolean;
  apiKey?: string;
}

export interface LLMConfigWithModelId extends LLMConfig {
  modelId: string;
}

/**
 * Gets the LLM config for a given model id.
 * If not a managed model, will read the api key from the current workspace's llm vault.
 */
export async function getLLMConfig({
  modelId,
  llmVault,
}: {
  modelId: string;
  llmVault?: LLMVault;
}): Promise<LLMConfigWithModelId> {
  if (isWellKnownModel(modelId)) {
    return {
      model: modelId,
      modelId: modelId,
    };
  }
  if (!llmVault) {
    throw new Error("LLM vault not found");
  }

  // TODO(@camudo): cache for custom models, so we don't read the api key every time.
  const { model, apiKey } = await llmVault.readApiKey(modelId);

  return {
    model,
    apiKey: apiKey,
    bypassOpenRouter: true,
    modelId,
  };
}

export function createLLMInstance({
  model,
  bypassGateway,
  bypassOpenRouter,
  apiKey,
  envs,
}: LLMConfig & { envs: Record<string, string> }): {
  llm: LanguageModelV1;
  tokenLimit: number;
} {
  const [provider, ...rest] = model.split(":");
  const providerModel = rest.join(":");
  const accountId = envs?.ACCOUNT_ID ?? DEFAULT_ACCOUNT_ID;
  const gatewayId = envs?.GATEWAY_ID ?? DEFAULT_GATEWAY_ID;

  const providerClient = createLLMProvider({
    bypassOpenRouter,
    envs,
    accountId,
    gatewayId,
    provider,
    bypassGateway,
    apiKey,
  });

  return providerClient(providerModel);
}

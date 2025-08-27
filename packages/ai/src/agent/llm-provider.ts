import {
  type AnthropicProvider,
  createAnthropic as anthropic,
} from "@ai-sdk/anthropic";
import {
  createAnthropic as anthropicV5,
} from "@ai-sdk-v5/anthropic";
import {
  createDeepSeek as deepseek,
  type DeepSeekProvider,
} from "@ai-sdk/deepseek";
import {
  createGoogleGenerativeAI as google,
  type GoogleGenerativeAIProvider,
} from "@ai-sdk/google";
import {
  createGoogleGenerativeAI as googleV5,
} from "@ai-sdk-v5/google";
import { createOpenAI as openai, type OpenAIProvider } from "@ai-sdk/openai";
import { createOpenAI as openaiV5 } from "@ai-sdk-v5/openai";
import { createXai as xai, type XaiProvider } from "@ai-sdk/xai";
import { createOpenRouter as openrouterV4 } from "@openrouter/ai-sdk-provider";
import { createOpenRouter as openrouterV5 } from "@openrouter-ai-sdk-v5/provider";

import type { LanguageModelV1 } from "ai";
import type { LanguageModel } from "ai-v5";

interface AIGatewayOptions {
  accountId: string;
  gatewayId: string;
  provider: string;
  envs: Record<string, string>;
  bypassOpenRouter?: boolean;
  bypassGateway?: boolean;
  apiKey?: string;
  metadata?: Record<string, string>;
}

const aiGatewayForProvider = ({
  accountId,
  gatewayId,
  provider,
}: AIGatewayOptions) =>
  `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/${provider}`;

type ProviderFactory = (
  opts: AIGatewayOptions,
) => (model: string) => { llmV4: LanguageModelV1; llmV5?: LanguageModel, tokenLimit: number };

type NativeLLMV4Creator = <
  TOpts extends {
    baseURL?: string;
    apiKey: string;
    headers?: Record<string, string>;
  },
>(
  opts: TOpts,
) => (model: string) => LanguageModelV1;

type NativeLLMV5Creator = <
  TOpts extends {
    baseURL?: string;
    apiKey: string;
    headers?: Record<string, string>;
  },
>(
  opts: TOpts,
) => (model: string) => LanguageModel;

type ModelsOf<TProvider extends (model: string) => LanguageModelV1> =
  Parameters<TProvider>[0];

type Provider = {
  creator: { v4: NativeLLMV4Creator, v5: NativeLLMV5Creator } | NativeLLMV4Creator;
  envVarName: string;
  supportsOpenRouter?: boolean;
  mapOpenRouterModel?: Record<string, string>;
  tokenLimit?: Record<string | "default", number>;
};
/**
 * Supported providers for the AI Gateway
 */
const providers: Record<string, Provider> = {
  anthropic: {
    creator: { v4: anthropic, v5: anthropicV5 },
    envVarName: "ANTHROPIC_API_KEY",
    mapOpenRouterModel: {
      "claude-3.7-sonnet:thinking": "claude-3-7-sonnet-latest",
      "claude-sonnet-4": "claude-sonnet-4-20250514",
    } satisfies Partial<Record<string, ModelsOf<AnthropicProvider>>>,
    tokenLimit: {
      default: 200_000,
      "claude-3-5-sonnet-latest": 200_000,
    } satisfies Partial<
      Record<ModelsOf<AnthropicProvider> | "default", number>
    >,
  },
  google: {
    creator: { v4: google, v5: googleV5 },
    envVarName: "GOOGLE_API_KEY",
    tokenLimit: {
      default: 200_000,
      "gemini-2.5-pro-preview-03-25": 1_000_000,
    } satisfies Partial<
      Record<ModelsOf<GoogleGenerativeAIProvider> | "default", number>
    >,
  },
  openai: {
    creator: { v4: openai, v5: openaiV5 },
    envVarName: "OPENAI_API_KEY",
    tokenLimit: {
      default: 200_000,
      "gpt-4.1-nano": 1_047_576,
      "gpt-4.1-mini": 1_047_576,
      "gpt-4.1": 1_047_576,
      "o3-mini-high": 200_000,
    } satisfies Partial<Record<ModelsOf<OpenAIProvider> | "default", number>>,
  },
  deepseek: {
    creator: deepseek,
    envVarName: "DEEPSEEK_API_KEY",
    tokenLimit: {
      default: 200_000,
    } satisfies Partial<Record<ModelsOf<DeepSeekProvider> | "default", number>>,
  },
  "x-ai": {
    creator: xai,
    envVarName: "XAI_API_KEY",
    tokenLimit: {
      default: 200_000,
      "grok-3-beta": 131_072,
    } satisfies Partial<Record<ModelsOf<XaiProvider> | "default", number>>,
  },
} as const;

const OPENROUTER_HEADERS = {
  "HTTP-Referer": "https://deco.chat/about",
  "X-Title": "Deco",
};

const modelLimit = (provider: Provider, model: string) =>
  provider.tokenLimit?.[model] ?? provider.tokenLimit?.default ?? 200_000;

export const createLLMProvider: ProviderFactory = (opts) => {
  const provider = providers[opts.provider];
  if (!provider) {
    throw new Error(`Provider ${opts.provider} not supported`);
  }

  const supportsOpenRouter = provider.supportsOpenRouter !== false;
  const openRouterApiKey = opts.envs["OPENROUTER_API_KEY"];
  if (
    !supportsOpenRouter ||
    !openRouterApiKey ||
    opts.bypassOpenRouter ||
    opts.apiKey
  ) {
    const { v4, v5 } = typeof provider.creator === "function" ? { v4: provider.creator, v5: undefined } : provider.creator;
    const options = {
      apiKey: opts.apiKey ?? opts.envs[provider.envVarName],
      baseURL: opts.bypassGateway ? undefined : aiGatewayForProvider(opts),
      headers: opts.metadata
        ? {
          "cf-aig-metadata": JSON.stringify(opts.metadata),
        }
        : undefined,
    }
    const v4Creator = v4(options);
    const v5Creator = v5?.(options)
    return (model: string) => {
      model = opts.bypassOpenRouter
        ? (provider.mapOpenRouterModel?.[model] ?? model)
        : model;
      return { llmV4: v4Creator(model), llmV5: v5Creator?.(model), tokenLimit: modelLimit(provider, model) };
    };
  }

  const options = {
    apiKey: openRouterApiKey,
    headers: opts.metadata
      ? {
        ...OPENROUTER_HEADERS,
        "cf-aig-metadata": JSON.stringify(opts.metadata),
      }
      : undefined,
    baseURL: opts.bypassGateway
      ? undefined
      : aiGatewayForProvider({ ...opts, provider: "openrouter" }),
  }
  const openRouterProviderV4 = openrouterV4(options);
  const openRouterProviderV5 = openrouterV5(options);

  const creatorV4 = (model: string) =>
    openRouterProviderV4(`${opts.provider}/${model}`);

  const creatorV5 = (model: string) => openRouterProviderV5(`${opts.provider}/${model}`);

  return (model: string) => {
    return {
      llmV4: creatorV4(model),
      llmV5: creatorV5(model),
      tokenLimit: modelLimit(
        provider,
        provider.mapOpenRouterModel?.[model] ?? model,
      ),
    };
  };
};

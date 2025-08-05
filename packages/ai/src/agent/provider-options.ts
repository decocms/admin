import { DEFAULT_MIN_THINKING_TOKENS } from "@deco/sdk";

interface GetProviderOptionsParams {
  budgetTokens: number;
}

export function getProviderOptions({ budgetTokens }: GetProviderOptionsParams) {
  const opts: Record<string, any> = {};

  if (budgetTokens > DEFAULT_MIN_THINKING_TOKENS) {
    opts.anthropic = {
      thinking: {
        type: "enabled",
        budgetTokens,
      },
    };
  }

  // Prefer Cerebras and Groq when using Openrouter OSS models
  opts.openrouter = {
    provider: {
      order: ["groq", "cerebras"],
    },
  };

  return opts;
}

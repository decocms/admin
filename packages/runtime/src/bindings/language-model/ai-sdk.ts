import type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  ProviderV2,
} from "@ai-sdk/provider";
import { LanguageModelBinding } from "@decocms/bindings/llm";
import { lazy, responseToStream } from "./utils";

const toRegExp = (supportedUrls: Record<string, string[]>) => {
  return Object.fromEntries(
    Object.entries(supportedUrls).map(([key, values]) => [
      key,
      values.map((v) => new RegExp(v)),
    ]),
  );
};

type LLMBindingClient = ReturnType<
  (typeof LanguageModelBinding)["forConnection"]
>;

export interface Provider extends ProviderV2 {
  listModels: LLMBindingClient["COLLECTION_LLM_LIST"];
}

/**
 * Creates a ai-sdk compatible provider for the given binding
 * @param binding - The binding to create the provider from
 * @returns The provider
 */
export const createProvider = (binding: LLMBindingClient): Provider => {
  return {
    imageModel: () => {
      throw new Error("Image models are not supported by this provider");
    },
    textEmbeddingModel: () => {
      throw new Error(
        "Text embedding models are not supported by this provider",
      );
    },
    listModels: async () => {
      return await binding.COLLECTION_LLM_LIST({});
    },
    languageModel: (modelId: string): LanguageModelV2 => {
      const supportedUrls = lazy(
        (): Promise<Record<string, RegExp[]>> =>
          binding
            .LLM_METADATA({ modelId })
            .then((metadata: { supportedUrls: Record<string, string[]> }) =>
              toRegExp(metadata.supportedUrls),
            ),
      );

      return {
        specificationVersion: "v2" as const,
        provider: "llm-binding",
        modelId,
        supportedUrls,
        doGenerate: async (options: LanguageModelV2CallOptions) => {
          const response = await binding.LLM_DO_GENERATE({
            callOptions: options,
            modelId,
          });
          // Ensure usage fields are always present as required by LanguageModelV2
          return {
            ...response,
            usage: {
              inputTokens: response.usage.inputTokens ?? undefined,
              outputTokens: response.usage.outputTokens ?? undefined,
              totalTokens: response.usage.totalTokens ?? undefined,
              reasoningTokens: response.usage.reasoningTokens ?? undefined,
            },
          };
        },
        doStream: async (options: LanguageModelV2CallOptions) => {
          const response = await binding.LLM_DO_STREAM({
            callOptions: options,
            modelId,
          });
          return {
            stream: responseToStream(response),
            response: {
              headers: Object.fromEntries(response.headers?.entries() ?? []),
            },
          };
        },
      };
    },
  };
};

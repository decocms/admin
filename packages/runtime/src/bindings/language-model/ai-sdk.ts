import type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  ProviderV2,
} from "@ai-sdk/provider";
import z from "zod";
import { LanguageModelBinding } from "../binder.ts";
import { ListModelsOutputSchema } from "./binding.ts";
import { responseToStream } from "./utils.ts";

const toRegExp = (supportedUrls: Record<string, string[]>) => {
  return Object.fromEntries(
    Object.entries(supportedUrls).map(([key, values]) => [
      key,
      values.map((v) => new RegExp(v)),
    ]),
  );
};

export interface Provider extends ProviderV2 {
  listModels: () => Promise<z.infer<typeof ListModelsOutputSchema>>;
}

/**
 * Creates a ai-sdk compatible provider for the given binding
 * @param binding - The binding to create the provider from
 * @returns The provider
 */
export const createProvider = (
  binding: ReturnType<(typeof LanguageModelBinding)["forConnection"]>,
): Provider => {
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
      const response = await binding.LLM_LIST_MODELS({});
      return response;
    },
    languageModel: (modelId: string): LanguageModelV2 => {
      let metadataPromise:
        | Promise<{ supportedUrls: Record<string, string[]> }>
        | undefined;
      const fetchMetadataOnce = async () => {
        return (metadataPromise ??= binding.LLM_METADATA({ modelId }));
      };

      const supportedUrlsPromise =
        Promise.withResolvers<Record<string, RegExp[]>>();

      const supportedUrls = new Proxy<Promise<Record<string, RegExp[]>>>(
        supportedUrlsPromise.promise,
        {
          get(target, prop) {
            fetchMetadataOnce()
              .then((metadata) =>
                supportedUrlsPromise.resolve(toRegExp(metadata.supportedUrls)),
              )
              .catch(supportedUrlsPromise.reject);
            return target[prop as keyof typeof target];
          },
        },
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

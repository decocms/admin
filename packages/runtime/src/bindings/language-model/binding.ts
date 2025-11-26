/**
 * Models Well-Known Binding
 *
 * Defines the interface for AI model providers.
 * Any MCP that implements this binding can provide AI models and streaming endpoints.
 *
 * This binding uses collection bindings for LIST and GET operations (read-only).
 * Streaming endpoint information is included directly in the model entity schema.
 */

import { z } from "zod";
import type { ToolBinder } from "../../mcp.ts";

/**
 * Language Model Call Options Schema
 * Based on LanguageModelV2CallOptions from @ai-sdk/provider
 */
export const LanguageModelCallOptionsSchema = z.object({
  // Core parameters
  prompt: z
    .any()
    .describe(
      "A language mode prompt is a standardized prompt type (messages, system, etc.)",
    ),

  // Generation parameters
  maxOutputTokens: z
    .number()
    .optional()
    .describe("Maximum number of tokens to generate"),
  temperature: z
    .number()
    .optional()
    .describe(
      "Temperature setting. The range depends on the provider and model",
    ),
  topP: z.number().optional().describe("Nucleus sampling parameter"),
  topK: z
    .number()
    .optional()
    .describe(
      "Only sample from the top K options for each subsequent token. Used to remove long tail low probability responses",
    ),
  presencePenalty: z
    .number()
    .optional()
    .describe(
      "Presence penalty setting. It affects the likelihood of the model to repeat information that is already in the prompt",
    ),
  frequencyPenalty: z
    .number()
    .optional()
    .describe(
      "Frequency penalty setting. It affects the likelihood of the model to repeatedly use the same words or phrases",
    ),
  seed: z
    .number()
    .optional()
    .describe(
      "The seed (integer) to use for random sampling. If set and supported by the model, calls will generate deterministic results",
    ),

  // Stop sequences
  stopSequences: z
    .array(z.string())
    .optional()
    .describe(
      "Stop sequences. If set, the model will stop generating text when one of the stop sequences is generated",
    ),

  // Response format
  responseFormat: z
    .union([
      z.object({ type: z.literal("text") }),
      z.object({
        type: z.literal("json"),
        schema: z
          .any()
          .optional()
          .describe("JSON schema that the generated output should conform to"),
        name: z
          .string()
          .optional()
          .describe("Name of output that should be generated"),
        description: z
          .string()
          .optional()
          .describe("Description of the output that should be generated"),
      }),
    ])
    .optional()
    .describe(
      "Response format. The output can either be text or JSON. Default is text",
    ),

  // Tools
  tools: z
    .array(z.any())
    .optional()
    .describe("The tools that are available for the model"),
  toolChoice: z
    .any()
    .optional()
    .describe("Specifies how the tool should be selected. Defaults to 'auto'"),

  // Stream options
  includeRawChunks: z
    .boolean()
    .optional()
    .describe(
      "Include raw chunks in the stream. Only applicable for streaming calls",
    ),

  // Abort signal
  abortSignal: z
    .any()
    .optional()
    .describe("Abort signal for cancelling the operation"),

  // Additional options
  headers: z
    .record(z.string(), z.union([z.string(), z.undefined()]))
    .optional()
    .describe("Additional HTTP headers to be sent with the request"),
  providerOptions: z
    .any()
    .optional()
    .describe("Additional provider-specific options"),
});

/**
 * Language Model Generate Output Schema
 * Based on the return type of LanguageModelV2.doGenerate from @ai-sdk/provider
 */
export const LanguageModelGenerateOutputSchema = z.object({
  // Ordered content that the model has generated
  content: z
    .array(z.any())
    .describe(
      "Ordered content that the model has generated (text, tool-calls, reasoning, files, sources)",
    ),

  // Finish reason (required)
  finishReason: z
    .enum([
      "stop",
      "length",
      "content-filter",
      "tool-calls",
      "error",
      "other",
      "unknown",
    ])
    .describe("Reason why generation stopped"),

  // Usage information (required)
  usage: z
    .object({
      inputTokens: z.number().optional(),
      outputTokens: z.number().optional(),
      totalTokens: z.number().optional(),
      reasoningTokens: z.number().optional(),
    })
    .passthrough()
    .transform((val) => ({
      inputTokens: val.inputTokens,
      outputTokens: val.outputTokens,
      totalTokens: val.totalTokens,
      reasoningTokens: val.reasoningTokens,
      ...val,
    }))
    .describe("Usage information for the language model call"),

  // Provider metadata
  providerMetadata: z
    .any()
    .optional()
    .describe("Additional provider-specific metadata"),

  // Request information for telemetry and debugging
  request: z
    .object({
      body: z
        .any()
        .optional()
        .describe("Request HTTP body sent to the provider API"),
    })
    .optional()
    .describe("Optional request information for telemetry and debugging"),

  // Response information for telemetry and debugging
  response: z
    .object({
      id: z.string().optional().describe("ID for the generated response"),
      timestamp: z
        .date()
        .optional()
        .describe("Timestamp for the start of the generated response"),
      modelId: z
        .string()
        .optional()
        .describe("The ID of the response model that was used"),
      headers: z
        .record(z.string(), z.string())
        .optional()
        .describe("Response headers"),
      body: z.any().optional().describe("Response HTTP body"),
    })
    .optional()
    .describe("Optional response information for telemetry and debugging"),

  // Warnings for the call (required)
  warnings: z
    .array(z.any())
    .describe("Warnings for the call, e.g. unsupported settings"),
});

/**
 * Language Model Stream Output Schema
 * Based on the return type of LanguageModelV2.doStream from @ai-sdk/provider
 */
export const LanguageModelStreamOutputSchema = z.object({
  // Stream of language model output parts
  stream: z.any().describe("ReadableStream of LanguageModelV2StreamPart"),

  // Request information for telemetry and debugging
  request: z
    .object({
      body: z
        .any()
        .optional()
        .describe("Request HTTP body sent to the provider API"),
    })
    .optional()
    .describe("Optional request information for telemetry and debugging"),

  // Response information
  response: z
    .object({
      headers: z
        .record(z.string(), z.string())
        .optional()
        .describe("Response headers"),
    })
    .optional()
    .describe("Optional response data"),
});

export const LanguageModelMetadataSchema = z.object({
  supportedUrls: z
    .record(z.string(), z.array(z.string()))
    .describe("Supported URL patterns by media type for the provider"),
});
export const ModelSchema = z.object({
  modelId: z.string().describe("The ID of the model"),
  // Model-specific fields
  logo: z.string().nullable(),
  description: z.string().nullable(),
  capabilities: z.array(z.string()),
  limits: z
    .object({
      contextWindow: z.number(),
      maxOutputTokens: z.number(),
    })
    .nullable(),
  costs: z
    .object({
      input: z.number(),
      output: z.number(),
    })
    .nullable(),
  // Provider information
  provider: z
    .enum([
      "openai",
      "anthropic",
      "google",
      "xai",
      "deepseek",
      "openai-compatible",
      "openrouter",
    ])
    .nullable(),
});

export const LanguageModelInputSchema = z.object({
  modelId: z.string().describe("The ID of the model"),
  callOptions: LanguageModelCallOptionsSchema,
});

export const ListModelsInputSchema = z.object({});
export const ListModelsOutputSchema = z.object({
  items: z.array(ModelSchema).describe("List of models"),
});
export const LANGUAGE_MODEL_BINDING_SCHEMA = [
  {
    name: "LLM_METADATA" as const,
    inputSchema: z.object({
      modelId: z.string().describe("The ID of the model"),
    }),
    outputSchema: LanguageModelMetadataSchema,
  },
  {
    name: "LLM_DO_STREAM" as const,
    inputSchema: LanguageModelInputSchema,
    streamable: true,
  },
  {
    name: "LLM_DO_GENERATE" as const,
    inputSchema: LanguageModelInputSchema,
    outputSchema: LanguageModelGenerateOutputSchema,
  },
  {
    name: "LLM_LIST_MODELS" as const,
    inputSchema: ListModelsInputSchema,
    outputSchema: ListModelsOutputSchema,
  },
] satisfies ToolBinder[];

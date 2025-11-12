import { getProviderOptions, providers } from "@deco/ai";
import {
  DEFAULT_MAX_STEPS,
  DEFAULT_MAX_TOKENS,
  DEFAULT_MODEL,
  MAX_MAX_STEPS,
  MAX_MAX_TOKENS,
} from "@deco/sdk";
import { PaymentRequiredError, UserInputError } from "@deco/sdk/errors";
import type { ModelV2Data } from "@deco/sdk/mcp/agents-v2/schemas";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { trace } from "@opentelemetry/api";
import type { LanguageModel } from "ai";
import {
  convertToModelMessages,
  pruneMessages,
  stepCountIs,
  streamText,
} from "ai";
import type { Context } from "hono";
import { z } from "zod";
import { honoCtxToAppCtx } from "./api.ts";
import type { AppEnv } from "./utils/context.ts";
import { State } from "./utils/context.ts";

/**
 * Request body schema for model stream endpoint
 */
const ModelsStreamRequestSchema = z.object({
  messages: z.array(z.any()), // UIMessage[] - too complex to validate
  temperature: z
    .number()
    .min(0)
    .max(2)
    .optional()
    .transform((val) => (val !== null && val !== undefined ? val : undefined)),
  maxOutputTokens: z
    .number()
    .int()
    .positive()
    .optional()
    .transform((val) => Math.min(val ?? DEFAULT_MAX_TOKENS, MAX_MAX_TOKENS)),
  maxStepCount: z
    .number()
    .int()
    .positive()
    .optional()
    .transform((val) => Math.min(val ?? DEFAULT_MAX_STEPS, MAX_MAX_STEPS)),
  maxWindowSize: z.number().int().positive().optional(),
  system: z.string().optional(),
  tools: z.record(z.array(z.string())).optional(), // Integration ID -> Tool names mapping
  threadId: z.string().optional(), // Thread ID for attribution and tracking
});

export type ModelsStreamRequest = z.infer<typeof ModelsStreamRequestSchema>;

/**
 * Get model instance from model configuration
 */
function getModelFromConfig(
  modelConfig: ModelV2Data,
  ctx: ReturnType<typeof honoCtxToAppCtx>,
): LanguageModel {
  const { provider: providerName, modelId } = modelConfig;

  // Get provider config
  const provider = providers[providerName];
  if (!provider) {
    throw new Error(`Provider ${providerName} not supported`);
  }

  const envVars = ctx.envVars as Record<string, string | undefined>;

  // Check if we should use OpenRouter (default to false for custom models)
  const useOpenRouter = false;
  const openRouterApiKey = envVars.OPENROUTER_API_KEY;
  const supportsOpenRouter = provider.supportsOpenRouter !== false;

  if (useOpenRouter && supportsOpenRouter && openRouterApiKey) {
    // Create OpenRouter provider
    const openRouterProvider = createOpenRouter({
      apiKey: openRouterApiKey,
      headers: {
        "HTTP-Referer": "https://decocms.com",
        "X-Title": "Deco",
      },
    });

    return openRouterProvider(`${providerName}/${modelId}`);
  }

  // Use direct provider API
  let finalModelId = modelId;

  // Map OpenRouter model names to native names if needed
  if (provider.mapOpenRouterModel?.[modelId]) {
    finalModelId = provider.mapOpenRouterModel[modelId];
  }

  // Get API key from context env vars
  const apiKey = envVars[provider.envVarName];
  if (!apiKey) {
    throw new Error(
      `Missing API key for provider ${providerName}: ${provider.envVarName}`,
    );
  }

  // Create provider instance and call with model name
  const providerFn = provider.creator({ apiKey });
  return providerFn(finalModelId);
}

/**
 * Model streaming endpoint handler
 * Reads model configuration from deconfig and streams text responses
 */
export async function handleModelsStream(c: Context<AppEnv>) {
  const ctx = honoCtxToAppCtx(c);
  const rawBody = await c.req.json();

  const tracer = trace.getTracer("models-stream");

  // Get model ID from route params
  const modelId = c.req.param("modelId");
  if (!modelId) {
    throw new UserInputError("Model ID is required");
  }

  // Parse and validate request body
  const { success, data, error } =
    ModelsStreamRequestSchema.safeParse(rawBody);

  if (!success) {
    throw new UserInputError(
      `Invalid request body: ${JSON.stringify(error.format())}`,
    );
  }

  const {
    messages,
    temperature,
    maxOutputTokens,
    maxStepCount,
    maxWindowSize,
    system,
    tools,
    threadId,
  } = data;

  // Read model configuration from deconfig
  const modelFilePath = `/models/${modelId}.json`;
  let modelConfig: ModelV2Data;

  try {
    // Use deconfig client to read model configuration
    // This will require access to the deconfig client from context
    // For now, throw an error indicating this needs to be implemented
    throw new Error(
      "Reading model config from deconfig not yet implemented. Need to access deconfig client from context.",
    );

    // The implementation should look like:
    // const deconfigClient = getDeconfigClient(ctx);
    // const fileData = await deconfigClient.READ_FILE({
    //   path: modelFilePath,
    //   format: "plainString",
    // });
    // modelConfig = JSON.parse(fileData.content as string);
  } catch (err) {
    throw new UserInputError(
      `Failed to read model configuration: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Convert UIMessages to CoreMessages
  const modelMessages = convertToModelMessages(messages);

  // Get model instance from configuration
  const llm = getModelFromConfig(modelConfig, ctx);

  const onFinish = Promise.withResolvers<void>();

  // Prune messages to reduce context size
  const prunedMessages = pruneMessages({
    messages: modelMessages,
    reasoning: "before-last-message",
    emptyMessages: "remove",
    toolCalls: "none",
  }).slice(-(maxWindowSize ?? 10));

  // Build system prompt
  const systemPrompt = [system, modelConfig.description]
    .filter(Boolean)
    .join("\n\n");

  // Call streamText with validated parameters
  const stream = streamText({
    model: llm,
    messages: prunedMessages,
    system: systemPrompt || undefined,
    temperature,
    maxOutputTokens,
    stopWhen: [stepCountIs(maxStepCount ?? DEFAULT_MAX_STEPS)],
    providerOptions: getProviderOptions({
      budgetTokens: Math.floor((maxOutputTokens ?? DEFAULT_MAX_TOKENS) * 0.2),
    }),
    onFinish: (result) => {
      // TODO: Track usage for custom models
      console.log("Model stream finished", {
        modelId,
        usage: result.usage,
      });
      onFinish.resolve();
    },
    onAbort: (args) => {
      console.error("Abort on model stream", args);
      onFinish.reject();
    },
    onError: (error) => {
      console.error("Error on model stream", error);
      onFinish.reject(error);
    },
    experimental_telemetry: {
      recordInputs: true,
      recordOutputs: true,
      isEnabled: true,
      tracer,
    },
  });

  c.executionCtx.waitUntil(onFinish.promise);

  return stream.toUIMessageStreamResponse();
}


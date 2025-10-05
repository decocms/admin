import {
  type AnthropicProvider,
  createAnthropic as anthropic,
} from "@ai-sdk/anthropic";
import {
  createDeepSeek as deepseek,
  type DeepSeekProvider,
} from "@ai-sdk/deepseek";
import {
  createGoogleGenerativeAI as google,
  type GoogleGenerativeAIProvider,
} from "@ai-sdk/google";
import { createOpenAI as openai, type OpenAIProvider } from "@ai-sdk/openai";
import { createXai as xai, type XaiProvider } from "@ai-sdk/xai";
import { createOpenRouter as openrouter } from "@openrouter/ai-sdk-provider";
import type {
  JSONValue,
  LanguageModelV1,
  LanguageModelV1CallOptions,
  LanguageModelV1CallWarning,
  LanguageModelV1FinishReason,
  LanguageModelV1Message,
  LanguageModelV1Prompt,
  LanguageModelV1ProviderMetadata,
  LanguageModelV1StreamPart,
} from "@ai-sdk/provider";

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
) => (model: string) => { llm: LanguageModelV1; tokenLimit: number };

type NativeLLMCreator = <
  TOpts extends {
    baseURL?: string;
    apiKey: string;
    headers?: Record<string, string>;
  },
>(
  opts: TOpts,
) => (model: string) => LanguageModelV1;

type ModelsOf<TProvider extends (model: string) => LanguageModelV1> =
  Parameters<TProvider>[0];

type Provider = {
  creator: NativeLLMCreator;
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
    creator: anthropic,
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
    creator: google,
    envVarName: "GOOGLE_API_KEY",
    tokenLimit: {
      default: 200_000,
      "gemini-2.5-pro-preview-03-25": 1_000_000,
    } satisfies Partial<
      Record<ModelsOf<GoogleGenerativeAIProvider> | "default", number>
    >,
  },
  openai: {
    creator: openai,
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
  "HTTP-Referer": "https://decocms.com",
  "X-Title": "Deco",
};

const modelLimit = (provider: Provider, model: string) =>
  provider.tokenLimit?.[model] ?? provider.tokenLimit?.default ?? 200_000;

const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_OLLAMA_TOKEN_LIMIT = 128_000;

const sanitizeOllamaBaseUrl = (value?: string) => {
  if (!value) return DEFAULT_OLLAMA_BASE_URL;
  return value.endsWith("/") ? value.slice(0, -1) : value;
};

type OllamaChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OllamaToolCall = {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
};

type OllamaChatResponse = {
  model: string;
  created_at?: string;
  message?: {
    role: string;
    content: string;
    tool_calls?: OllamaToolCall[];
  };
  done?: boolean;
  done_reason?: string;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
};

const asPlainObject = (headers: Headers): Record<string, string> => {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
};

const normalizeHeaders = (
  headers?: Record<string, string | undefined>,
): Record<string, string> => {
  if (!headers) return {};
  return Object.fromEntries(
    Object.entries(headers).filter(([, value]) => value !== undefined),
  ) as Record<string, string>;
};

const mapFinishReason = (reason?: string): LanguageModelV1FinishReason => {
  switch (reason) {
    case "stop":
      return "stop";
    case "length":
      return "length";
    case "content_filter":
      return "content-filter";
    default:
      return reason ? "other" : "unknown";
  }
};

const stringifyJSON = (value: unknown, space = 2): string => {
  try {
    return JSON.stringify(value, null, space);
  } catch (_error) {
    return `${value}`;
  }
};

const appendOrPrependSystemInstruction = (
  messages: OllamaChatMessage[],
  instruction: string,
) => {
  if (!instruction) return;
  const existingSystemIndex = messages.findIndex(
    (msg) => msg.role === "system",
  );
  if (existingSystemIndex >= 0) {
    const current = messages[existingSystemIndex];
    messages[existingSystemIndex] = {
      ...current,
      content: `${current.content}\n\n${instruction}`.trim(),
    };
    return;
  }
  messages.unshift({ role: "system", content: instruction });
};

const convertToolResultToText = (result: unknown): string => {
  if (typeof result === "string") return result;
  if (result === undefined || result === null) {
    return "(tool returned no result)";
  }
  return stringifyJSON(result);
};

type MessagePart = { type?: string; [key: string]: unknown };

const partsToText = (
  parts: MessagePart[],
  warnings: LanguageModelV1CallWarning[],
): string => {
  return parts
    .map((part) => {
      const type = part["type"];
      if (type === "text") {
        return (part["text"] as string) ?? "";
      }
      if (type === "reasoning" || type === "redacted-reasoning") {
        return (part["text"] as string) ?? (part["data"] as string) ?? "";
      }
      if (type === "tool-call") {
        const toolName = part["toolName"] ?? part["tool_name"] ?? "tool";
        const args = part["args"] ?? part["arguments"];
        warnings.push({
          type: "other",
          message: `Converted a tool call (${toolName}) to plain text for Ollama.`,
        });
        return `Tool call ${toolName}: ${args}`;
      }
      if (type === "image") {
        const description = part["alt"] ?? "image attachment";
        warnings.push({
          type: "other",
          message: "Dropped image content when forwarding prompt to Ollama.",
        });
        return `[Image: ${description}]`;
      }
      if (type === "file") {
        const filename = (part["filename"] as string) ?? "file";
        warnings.push({
          type: "other",
          message: `Summarized file attachment (${filename}) for Ollama prompt.`,
        });
        return `[File: ${filename}]`;
      }
      if (type === "tool-result") {
        const toolName = part["toolName"] ?? "tool";
        const result = part["result"];
        const content = convertToolResultToText(part["content"] ?? result);
        return `Tool ${toolName} result: ${content}`;
      }
      return "";
    })
    .filter((chunk) => chunk !== "")
    .join("\n\n");
};

const convertPromptToOllamaMessages = (
  prompt: LanguageModelV1Prompt,
): {
  messages: OllamaChatMessage[];
  warnings: LanguageModelV1CallWarning[];
} => {
  const warnings: LanguageModelV1CallWarning[] = [];
  const messages: OllamaChatMessage[] = [];

  for (const message of prompt) {
    switch (message.role) {
      case "system": {
        if (typeof message.content === "string" && message.content.trim()) {
          messages.push({
            role: "system",
            content: message.content,
          });
        }
        break;
      }
      case "user": {
        const contentArray = Array.isArray(message.content)
          ? (message.content as unknown as MessagePart[])
          : ([{ type: "text", text: message.content }] as MessagePart[]);
        const content = partsToText(contentArray, warnings);
        if (content.trim()) {
          messages.push({ role: "user", content });
        }
        break;
      }
      case "assistant": {
        const contentArray = Array.isArray(message.content)
          ? (message.content as unknown as MessagePart[])
          : ([{ type: "text", text: message.content }] as MessagePart[]);
        const content = partsToText(contentArray, warnings);
        if (content.trim()) {
          messages.push({ role: "assistant", content });
        }
        break;
      }
      case "tool": {
        const contentArray = Array.isArray(message.content)
          ? (message.content as unknown as MessagePart[])
          : ([] as MessagePart[]);
        const content = partsToText(contentArray, warnings);
        if (content.trim()) {
          warnings.push({
            type: "other",
            message: "Converted tool output to assistant message for Ollama.",
          });
          messages.push({
            role: "assistant",
            content,
          });
        }
        break;
      }
      default: {
        const unknownRole = (message as { role: string }).role;
        warnings.push({
          type: "other",
          message: `Ignored message with unsupported role '${unknownRole}'.`,
        });
        break;
      }
    }
  }

  return { messages, warnings };
};

const buildProviderMetadata = (
  payload: OllamaChatResponse,
): LanguageModelV1ProviderMetadata | undefined => {
  const metadata: Record<string, JSONValue> = {};

  if (typeof payload.load_duration === "number") {
    metadata.loadDuration = payload.load_duration;
  }
  if (typeof payload.prompt_eval_duration === "number") {
    metadata.promptEvalDuration = payload.prompt_eval_duration;
  }
  if (typeof payload.eval_duration === "number") {
    metadata.evalDuration = payload.eval_duration;
  }
  if (typeof payload.prompt_eval_count === "number") {
    metadata.promptEvalCount = payload.prompt_eval_count;
  }
  if (typeof payload.eval_count === "number") {
    metadata.evalCount = payload.eval_count;
  }
  if (typeof payload.total_duration === "number") {
    metadata.totalDuration = payload.total_duration;
  }
  if (typeof payload.done === "boolean") {
    metadata.done = payload.done;
  }

  if (Object.keys(metadata).length === 0) {
    return undefined;
  }

  return { ollama: metadata };
};

class OllamaLanguageModel implements LanguageModelV1 {
  readonly specificationVersion = "v1" as const;
  readonly provider = "ollama";
  readonly defaultObjectGenerationMode = undefined;
  readonly supportsStructuredOutputs = false;
  readonly supportsImageUrls = false;

  constructor(
    private readonly config: {
      baseURL: string;
      modelId: string;
      metadata?: Record<string, string>;
    },
  ) {}

  get modelId() {
    return this.config.modelId;
  }

  supportsUrl(): boolean {
    return false;
  }

  private prepareRequest(options: LanguageModelV1CallOptions) {
    const { messages, warnings } = convertPromptToOllamaMessages(
      options.prompt,
    );

    const ollamaOptions: Record<string, unknown> = {};
    if (typeof options.maxTokens === "number") {
      ollamaOptions.num_predict = options.maxTokens;
    }
    if (typeof options.temperature === "number") {
      ollamaOptions.temperature = options.temperature;
    }
    if (typeof options.topP === "number") {
      ollamaOptions.top_p = options.topP;
    }
    if (typeof options.topK === "number") {
      ollamaOptions.top_k = options.topK;
    }
    if (typeof options.seed === "number") {
      ollamaOptions.seed = options.seed;
    }

    let format: string | undefined;
    if (options.responseFormat?.type === "json") {
      format = "json";
      if (options.responseFormat.schema) {
        const instruction = `Return ONLY a JSON object that matches this schema: ${stringifyJSON(options.responseFormat.schema)}.`;
        appendOrPrependSystemInstruction(messages, instruction);
      }
    }

    const mode = options.mode;
    if (mode?.type === "object-json") {
      format = "json";
      if (mode.schema) {
        const instruction = mode.description
          ? `${mode.description}\nSchema:${stringifyJSON(mode.schema)}`
          : `Return ONLY a JSON object that matches this schema: ${stringifyJSON(mode.schema)}.`;
        appendOrPrependSystemInstruction(messages, instruction);
      } else if (mode.description) {
        appendOrPrependSystemInstruction(messages, mode.description);
      }
    }

    // Ollama supports tool calling - convert tools to Ollama format
    const tools: Array<{
      type: "function";
      function: {
        name: string;
        description: string;
        parameters?: Record<string, unknown>;
      };
    }> = [];

    if (mode?.type === "regular" && mode.tools && mode.tools.length > 0) {
      for (const tool of mode.tools) {
        if (tool.type === "function") {
          tools.push({
            type: "function",
            function: {
              name: tool.name,
              description: tool.description || "",
              parameters: tool.parameters as Record<string, unknown>,
            },
          });
        }
      }
    }

    if (
      mode?.type === "regular" &&
      mode.toolChoice &&
      mode.toolChoice.type !== "auto"
    ) {
      warnings.push({
        type: "other",
        message: `Ollama only supports 'auto' tool choice, ignoring '${mode.toolChoice.type}'.`,
      });
    }

    const stopSequences = options.stopSequences?.filter(
      (sequence) => sequence.length > 0,
    );
    const body: Record<string, unknown> = {
      model: this.config.modelId,
      stream: false,
      messages,
    };
    if (stopSequences && stopSequences.length > 0) {
      body.stop = stopSequences;
    }
    if (Object.keys(ollamaOptions).length > 0) {
      body.options = ollamaOptions;
    }
    if (format) {
      body.format = format;
    }
    if (tools.length > 0) {
      body.tools = tools;
    }
    if (this.config.metadata) {
      body.metadata = this.config.metadata;
    }

    return {
      body,
      warnings,
      rawPrompt: messages,
      rawSettings: {
        options: ollamaOptions,
        stop: stopSequences,
        format,
        tools: tools.length > 0 ? tools : undefined,
      },
    };
  }

  private async invokeChat(options: LanguageModelV1CallOptions) {
    const prepared = this.prepareRequest(options);
    const headers = {
      "Content-Type": "application/json",
      ...normalizeHeaders(options.headers),
    };
    const requestBody = JSON.stringify(prepared.body);

    const response = await fetch(`${this.config.baseURL}/api/chat`, {
      method: "POST",
      headers,
      body: requestBody,
      signal: options.abortSignal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(
        `Ollama request failed with status ${response.status}: ${errorBody}`,
      );
    }

    const payload = (await response.json()) as OllamaChatResponse;

    return {
      payload,
      requestBody,
      responseHeaders: asPlainObject(response.headers),
      requestHeaders: headers,
      prepared,
    } as const;
  }

  private buildResult(invocation: Awaited<ReturnType<typeof this.invokeChat>>) {
    const { payload, prepared, requestBody, responseHeaders } = invocation;
    const text = payload.message?.content ?? "";
    const usage = {
      promptTokens: payload.prompt_eval_count ?? 0,
      completionTokens: payload.eval_count ?? 0,
    };
    const providerMetadata = buildProviderMetadata(payload);

    const response = payload.created_at
      ? {
          timestamp: new Date(payload.created_at),
          modelId: payload.model,
        }
      : { modelId: payload.model };

    const warnings =
      prepared.warnings.length > 0 ? prepared.warnings : undefined;

    // Convert Ollama tool calls to AI SDK format
    const toolCalls =
      payload.message?.tool_calls?.map((toolCall, index) => ({
        toolCallType: "function" as const,
        toolCallId: `call_${index}_${Date.now()}`,
        toolName: toolCall.function.name,
        args: stringifyJSON(toolCall.function.arguments, 0),
      })) ?? [];

    // When tool calls are present, finish reason should be "tool-calls"
    const finishReason =
      toolCalls.length > 0
        ? "tool-calls"
        : mapFinishReason(payload.done_reason);

    // Debug logging
    if (toolCalls.length > 0) {
      console.log("[Ollama] Tool calls detected:", toolCalls.length);
      console.log("[Ollama] Tool calls:", JSON.stringify(toolCalls, null, 2));
      console.log("[Ollama] Finish reason:", finishReason);
      console.log("[Ollama] Text content:", text);
    }

    return {
      text,
      toolCalls,
      finishReason,
      usage,
      rawCall: {
        rawPrompt: prepared.rawPrompt,
        rawSettings: prepared.rawSettings,
      },
      rawResponse: {
        headers: responseHeaders,
        body: payload,
      },
      request: {
        body: requestBody,
      },
      providerMetadata,
      response,
      warnings,
    };
  }

  async doGenerate(options: LanguageModelV1CallOptions) {
    const invocation = await this.invokeChat(options);
    const result = this.buildResult(invocation);

    return {
      text: result.text || undefined,
      toolCalls: result.toolCalls,
      finishReason: result.finishReason,
      usage: result.usage,
      rawCall: result.rawCall,
      rawResponse: result.rawResponse,
      request: result.request,
      providerMetadata: result.providerMetadata,
      response: result.response,
      warnings: result.warnings,
    };
  }

  async doStream(options: LanguageModelV1CallOptions) {
    const invocation = await this.invokeChat(options);
    const result = this.buildResult(invocation);

    const stream = new ReadableStream<LanguageModelV1StreamPart>({
      start(controller) {
        if (result.text) {
          controller.enqueue({ type: "text-delta", textDelta: result.text });
        }
        // Emit tool calls if present
        for (const toolCall of result.toolCalls) {
          controller.enqueue({
            type: "tool-call",
            ...toolCall,
          });
        }
        controller.enqueue({
          type: "finish",
          finishReason: result.finishReason,
          usage: result.usage,
          providerMetadata: result.providerMetadata,
        });
        controller.close();
      },
    });

    return {
      stream,
      rawCall: result.rawCall,
      rawResponse: result.rawResponse,
      request: result.request,
      warnings: result.warnings,
    };
  }
}

export const createLLMProvider: ProviderFactory = (opts) => {
  if (opts.provider === "ollama") {
    const overrideBaseURL =
      typeof opts.apiKey === "string" && opts.apiKey.trim().length > 0
        ? opts.apiKey.trim()
        : undefined;
    const baseURL = sanitizeOllamaBaseUrl(
      overrideBaseURL ?? opts.envs?.["OLLAMA_BASE_URL"],
    );
    const tokenLimit =
      Number(opts.envs?.["OLLAMA_TOKEN_LIMIT"]) || DEFAULT_OLLAMA_TOKEN_LIMIT;

    return (model: string) => ({
      llm: new OllamaLanguageModel({
        baseURL,
        modelId: model,
        metadata: opts.metadata,
      }),
      tokenLimit,
    });
  }

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
    const creator = provider.creator({
      apiKey: opts.apiKey ?? opts.envs[provider.envVarName],
      baseURL: opts.bypassGateway ? undefined : aiGatewayForProvider(opts),
      headers: opts.metadata
        ? {
            "cf-aig-metadata": JSON.stringify(opts.metadata),
          }
        : undefined,
    });
    return (model: string) => {
      model = opts.bypassOpenRouter
        ? (provider.mapOpenRouterModel?.[model] ?? model)
        : model;
      return { llm: creator(model), tokenLimit: modelLimit(provider, model) };
    };
  }

  const openRouterProvider = openrouter({
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
  });

  const creator = (model: string) =>
    openRouterProvider(`${opts.provider}/${model}`);
  return (model: string) => {
    return {
      llm: creator(model),
      tokenLimit: modelLimit(
        provider,
        provider.mapOpenRouterModel?.[model] ?? model,
      ),
    };
  };
};

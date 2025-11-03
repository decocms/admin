import { AgentWallet, getProviderOptions, providers } from "@deco/ai";
import {
  DEFAULT_MAX_STEPS,
  DEFAULT_MAX_TOKENS,
  DEFAULT_MEMORY,
  DEFAULT_MODEL,
  Integration,
  MAX_MAX_STEPS,
  MAX_MAX_TOKENS,
  WELL_KNOWN_MODELS,
} from "@deco/sdk";
import { PaymentRequiredError, UserInputError } from "@deco/sdk/errors";
import { PROJECT_TOOLS } from "@deco/sdk/mcp";
import { createWalletClient } from "@deco/sdk/mcp/wallet";
import type { Workspace } from "@deco/sdk/path";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { trace } from "@opentelemetry/api";
import type { LanguageModel, LanguageModelUsage } from "ai";
import {
  convertToModelMessages,
  pruneMessages,
  stepCountIs,
  streamText,
  tool,
} from "ai";
import type { Context } from "hono";
import { z } from "zod";
import { honoCtxToAppCtx } from "./api.ts";
import type { AppEnv } from "./utils/context.ts";
import { State } from "./utils/context.ts";

/**
 * Request body schema for decopilot stream endpoint
 * Includes validation and transformation for all parameters
 */
const DecopilotStreamRequestSchema = z.object({
  messages: z.array(z.any()), // UIMessage[] - too complex to validate, pass through
  context: z.array(z.any()).optional(), // UIMessage[] - Context messages that will not be persisted to the thread
  model: z
    .object({
      id: z.string().optional(),
      useOpenRouter: z.boolean().optional().default(true),
    })
    .optional()
    .default({ useOpenRouter: true }),
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
  maxWindowSize: z
    .number()
    .int()
    .positive()
    .optional()
    .transform((val) =>
      Math.min(val ?? DEFAULT_MEMORY.last_messages, Infinity),
    ),

  system: z.string().optional(),
  tools: z.record(z.array(z.string())).optional(), // Integration ID -> Tool names mapping
  threadId: z.string().optional(), // Thread ID for attribution and tracking
});

export type DecopilotStreamRequest = z.infer<
  typeof DecopilotStreamRequestSchema
>;

/**
 * Get model instance, handling OpenRouter if enabled
 */
function getModel(
  modelId: string | undefined,
  useOpenRouter: boolean,
  ctx: ReturnType<typeof honoCtxToAppCtx>,
): LanguageModel {
  console.log("[getModel] Input modelId:", modelId, "useOpenRouter:", useOpenRouter);
  
  // Check if this is an Ollama model (format: "ollama:model-name")
  const isOllamaModel = modelId?.startsWith("ollama:");
  
  // Find model in WELL_KNOWN_MODELS, or if it's an Ollama model use it directly, otherwise use default
  let model: { id: string; model: string };
  if (isOllamaModel && modelId) {
    // Use the Ollama model directly
    model = { id: modelId, model: modelId };
    console.log("[getModel] Using Ollama model directly:", modelId);
  } else {
    // Find in well-known models or use default
    model = WELL_KNOWN_MODELS.find((m) => m.id === modelId) || DEFAULT_MODEL;
    console.log("[getModel] Resolved model:", {
      id: model.id,
      model: model.model,
      usedDefault: !WELL_KNOWN_MODELS.find((m) => m.id === modelId),
    });
  }

  // Parse provider and model name from "provider:model" format
  const [providerName, ...modelParts] = model.model.split(":");
  let modelName = modelParts.join(":");

  console.log("[getModel] Parsed provider:", providerName, "modelName:", modelName);

  // Get provider config
  const provider = providers[providerName];
  if (!provider) {
    throw new Error(`Provider ${providerName} not supported`);
  }

  // Check if we should use OpenRouter
  const envVars = ctx.envVars as Record<string, string | undefined>;
  const openRouterApiKey = envVars.OPENROUTER_API_KEY;
  const supportsOpenRouter = provider.supportsOpenRouter !== false;

  console.log("[getModel] OpenRouter check:", {
    useOpenRouter,
    supportsOpenRouter,
    hasApiKey: !!openRouterApiKey,
  });

  if (useOpenRouter && supportsOpenRouter && openRouterApiKey) {
    console.log("[getModel] Using OpenRouter with model:", `${providerName}/${modelName}`);
    // Create OpenRouter provider
    const openRouterProvider = createOpenRouter({
      apiKey: openRouterApiKey,
      headers: {
        "HTTP-Referer": "https://decocms.com",
        "X-Title": "Deco",
      },
    });

    // Use the model name as-is for OpenRouter (e.g., "claude-sonnet-4.5")
    return openRouterProvider(`${providerName}/${modelName}`);
  }

  console.log("[getModel] Using direct provider API");
  
  // Not using OpenRouter - use direct provider API
  // Map OpenRouter model names to native names if needed
  if (provider.mapOpenRouterModel?.[modelName]) {
    console.log("[getModel] Mapping model name from", modelName, "to", provider.mapOpenRouterModel[modelName]);
    modelName = provider.mapOpenRouterModel[modelName];
  }

  console.log("[getModel] Final call - provider:", providerName, "model:", modelName);
  
  // Ollama uses baseURL instead of API key
  if (providerName === "ollama") {
    const baseURL = envVars[provider.envVarName] || "http://localhost:11434";
    console.log("[getModel] Using Ollama with baseURL:", baseURL);
    const providerFn = provider.creator({ baseURL });
    return providerFn(modelName);
  }

  // Get API key from context env vars for other providers
  const apiKey = envVars[provider.envVarName];
  if (!apiKey) {
    throw new Error(
      `Missing API key for provider ${providerName}: ${provider.envVarName}`,
    );
  }
  
  // Create provider instance and call with model name
  const providerFn = provider.creator({ apiKey });
  return providerFn(modelName);
}

/**
 * Create tools for decopilot agent
 * Only two tools: integrations_get and integrations_call_tool
 */
const createDecopilotTools = (ctx: ReturnType<typeof honoCtxToAppCtx>) => {
  // Find the actual tool definitions from PROJECT_TOOLS
  const integrationsGetTool = PROJECT_TOOLS.find(
    (t) => t.name === "INTEGRATIONS_GET",
  );
  const integrationsCallToolTool = PROJECT_TOOLS.find(
    (t) => t.name === "INTEGRATIONS_CALL_TOOL",
  );

  if (!integrationsGetTool || !integrationsCallToolTool) {
    throw new Error("Required integration tools not found");
  }

  return {
    READ_MCP: tool({
      ...integrationsGetTool,
      name: "READ_MCP",
      execute: (input) =>
        State.run(ctx, async () => {
          const { id, name, tools } = await integrationsGetTool.handler(input);
          return { id, name, tools };
        }),
    }),
    CALL_TOOL: tool({
      ...integrationsCallToolTool,
      name: "CALL_TOOL",
      // @ts-expect-error - Tool type compatibility issue with AI SDK
      execute: (input) =>
        State.run(ctx, async () => {
          const { isError, content, ...rest } =
            await integrationsCallToolTool.handler(input);

          // Prefer content over structuredContent because this will be feed directly to the LLM.
          return Array.isArray(content) && content.length > 0
            ? { isError, content }
            : { isError, ...rest }; // this ...rest is important for non compliant tools
        }),
    }),
  };
};

// Get integrations list for system context
const listIntegrationsTool = PROJECT_TOOLS.find(
  (t) => t.name === "INTEGRATIONS_LIST",
);

type ToolLike = {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
};

const INTEGRATIONS_DENY_LIST = new Set([
  "i:contracts-management",
  "i:prompt-management",
  "i:oauth-management",
  "i:model-management",
  "i:team-management",
  "i:kb-management",
  "i:hosting",
  "i:deconfig-management",
  "i:wallet-management",
  "i:channel-management",
  "i:integration-management",
  "i:registry-management",
  "DECO_UTILS",
]);

const listIntegrations = async (ctx: ReturnType<typeof honoCtxToAppCtx>) => {
  if (!listIntegrationsTool) {
    throw new Error("INTEGRATIONS_LIST tool not found");
  }
  const { items } = await State.run(ctx, () =>
    listIntegrationsTool.handler({}),
  );

  return items.filter((i) => !INTEGRATIONS_DENY_LIST.has(i.id));
};

const formatAvailableIntegrations = (items: Integration[]) =>
  items
    .map(
      (i) =>
        `- ${i.name ?? "Untitled"} (${i.id}): ${i.description || "No description"}`,
    )
    .join("\n");

const formatAvailableTools = (
  items: Integration[],
  ctxToolSet?: Record<string, string[]>,
) => {
  const toolsByIntegration = new Map<string, ToolLike[]>();
  for (const { id, tools } of items) {
    const set = new Set(ctxToolSet?.[id] ?? []);
    if (set.size === 0) {
      continue;
    }

    const availableTools = tools?.filter((t) => set.has(t.name));
    if (!availableTools) {
      continue;
    }

    toolsByIntegration.set(id, availableTools);
  }

  const keys = ["name", "inputSchema", "outputSchema", "description"] as const;
  const availableTools = Array.from(toolsByIntegration.entries()).map(
    ([id, tools]) =>
      `For integration with id ${id}:\n${keys.join(",")}\n${tools.map((t) => keys.map((k) => JSON.stringify(t[k])).join(",")).join("\n")}`,
  );

  return availableTools.join("\n\n");
};

const DECOCMS_PLATFORM_SUMMARY = `
decocms.com is an open-source platform for building and deploying production-ready AI applications. It provides developers with a complete infrastructure to rapidly create, manage, and scale AI-native internal software using the Model Context Protocol (MCP).

**Core Platform Capabilities:**

**1. Tools:** Atomic capabilities exposed via MCP integrations. Tools are reusable functions that call external APIs, databases, or AI models. Each tool has typed input/output schemas using Zod validation, making them composable across agents and workflows. Tools follow the pattern RESOURCE_ACTION (e.g., AGENTS_CREATE, DOCUMENTS_UPDATE) and are organized into tool groups by functionality.

**2. Agents:** AI-powered assistants that combine a language model, specialized instructions (system prompt), and a curated toolset. Agents solve focused problems through conversational experiences. Each agent has configurable parameters including max steps, max tokens, memory settings, and visibility (workspace/public). Agents can invoke tools dynamically during conversations to accomplish complex tasks.

**3. Workflows:** Orchestrated processes that combine tools, code steps, and conditional logic into automated sequences. Workflows use the Mastra framework with operators like .then(), .parallel(), .branch(), and .dountil(). They follow an alternating pattern: Input → Code → Tool Call → Code → Tool Call → Output. Code steps transform data between tool calls, and workflows can sleep, wait, and manage complex state.

**4. Views:** Custom React-based UI components that render in isolated iframes. Views provide tailored interfaces, dashboards, and interactive experiences. They use React 19, Tailwind CSS v4, and a global callTool() function to invoke any workspace tool. Views support custom import maps and are sandboxed for security.

**5. Documents:** Markdown-based content storage with full editing capabilities. Documents support standard markdown syntax (headers, lists, code blocks, tables) and are searchable by name, description, content, and tags. They're ideal for documentation, notes, guides, and collaborative content.

**6. Databases:** Resources 2.0 system providing typed, versioned data models stored in DECONFIG (a git-like filesystem on Cloudflare Durable Objects). Supports full CRUD operations with schema validation, enabling admin tables and forms.

**7. Apps & Marketplace:** Pre-built MCP integrations installable with one click. Apps expose tools that appear in the admin menu and can be used by agents, workflows, and views. The marketplace provides curated integrations for popular services.

**Architecture:** Built on Cloudflare Workers for global, low-latency deployment. Uses TypeScript throughout with React 19 + Vite frontend, Tailwind CSS v4 design system, and typed RPC between client and server. Authorization follows policy-based access control with role-based permissions (Owner, Admin, Member). Data flows through React Query with optimistic updates.

**Development Workflow:** Developers vibecode their apps across tools, agents, workflows, and views. The platform auto-generates a beautiful admin interface with navigation, permissions, and deployment hooks. Local development via 'deco dev', type generation via 'deco gen', deployment to edge via 'deco deploy'.

**Key Benefits:** Open-source and self-hostable, full ownership of code and data, bring your own AI models and keys, unified TypeScript stack, visual workspace management, secure multi-tenancy, cost control and observability, rapid prototyping to production scale.
`;

const SYSTEM_PROMPT = `You are an intelligent assistant for decocms.com, an open-source platform for building production-ready AI applications.

${DECOCMS_PLATFORM_SUMMARY}

**Your Capabilities:**
- Search and navigate workspace resources (agents, documents, views, workflows, tools)
- Create and manage agents with specialized instructions and toolsets
- Design and compose workflows using tools and orchestration patterns
- Build React-based views with Tailwind CSS for custom interfaces
- Create and edit markdown documents with full formatting support
- Configure integrations and manage MCP connections
- Explain platform concepts and best practices
- Provide code examples and implementation guidance

**How You Help Users:**
- Answer questions about the platform's capabilities
- Guide users through creating agents, workflows, views, and tools
- Help troubleshoot issues and debug implementations
- Recommend architecture patterns for their use cases
- Explain authorization, security, and deployment processes
- Assist with TypeScript, React, Zod schemas, and Mastra workflows

**Important Working Patterns:**

1. **When helping with documents (especially PRDs, guides, or documentation):**
   - ALWAYS read the document first using @DECO_RESOURCE_DOCUMENT_READ or @DECO_RESOURCE_DOCUMENT_SEARCH
   - Understand the current content and structure before suggesting changes
   - If it's a PRD template, help fill in each section based on platform capabilities
   - Maintain the existing format and structure while improving content
   - Suggest specific, actionable content based on platform patterns

2. **When users reference "this document" or "help me with this PRD":**
   - Immediately use @DECO_RESOURCE_DOCUMENT_SEARCH to find relevant documents
   - Read the document content to understand context
   - Ask clarifying questions based on what's already written
   - Build upon their existing work rather than starting from scratch

3. **For AI App PRDs specifically:**
   - Understand they're planning Tools, Agents, Workflows, Views, and Databases
   - Ask about the problem they're solving and users they're serving
   - Help design the architecture using platform capabilities
   - Provide code examples for tool schemas, workflow orchestrations, etc.
   - Recommend authorization patterns and best practices

You have access to all workspace tools and can perform actions directly. When users ask to create or modify resources, use the available tools proactively. **Always read documents before helping edit them - this ensures you maintain their structure and build upon their existing work.**`;

/**
 * Decopilot streaming endpoint handler
 * Uses AI SDK v5's streamText directly with only 2 tools
 * (integrations_get and integrations_call_tool)
 *
 * Integration list is fetched internally and included in system prompt context
 */
export async function handleDecopilotStream(c: Context<AppEnv>) {
  const ctx = honoCtxToAppCtx(c);
  const rawBody = await c.req.json();

  const tracer = trace.getTracer("decopilot-stream");

  // Create wallet for usage tracking
  const wallet = new AgentWallet({
    agentId: "decopilot",
    agentPath: "decopilot",
    wallet: createWalletClient(ctx.envVars.WALLET_API_KEY || ""),
  });

  // Parse and validate request body
  const { success, data, error } =
    DecopilotStreamRequestSchema.safeParse(rawBody);

  if (!success) {
    throw new UserInputError(
      `Invalid request body: ${JSON.stringify(error.format())}`,
    );
  }

  const {
    model,
    messages,
    temperature,
    maxOutputTokens,
    maxStepCount,
    maxWindowSize,
    system,
    context,
    tools,
    threadId,
  } = data;

  // Convert UIMessages to CoreMessages using AI SDK helper
  const modelMessages = convertToModelMessages(messages);
  const contextMessages = context ? convertToModelMessages(context) : [];

  // Fetch integrations list and check wallet balance in parallel
  const [integrations, hasBalance] = await Promise.all([
    tracer.startActiveSpan("list-integrations", () => listIntegrations(ctx)),
    tracer.startActiveSpan("check-wallet-balance", () =>
      wallet.canProceed(ctx.workspace?.value as Workspace),
    ),
  ]);

  // Check wallet balance before proceeding
  if (!hasBalance) {
    throw new PaymentRequiredError("Insufficient funds");
  }

  // Check if model supports tool calling BEFORE building system prompt
  // IMPORTANT: Only specific Ollama models support native tool calling
  const modelName = model.id?.toLowerCase() || "";
  const isOllamaModel = modelName.startsWith("ollama:");
  
  // Very conservative whitelist - only models VERIFIED to support tool calling in Ollama
  const supportsToolCalling = 
    !isOllamaModel || // All cloud models support tools
    // Qwen2.5 variants (NOT Qwen3, NOT VL models - tested and don't work)
    (modelName.includes("qwen2.5") && !modelName.includes("vl")) ||
    (modelName.includes("qwen-2.5") && !modelName.includes("vl")) ||
    // Llama 3.1+ with tool support
    modelName.includes("llama3.1") || 
    modelName.includes("llama3.2") ||
    modelName.includes("llama3.3") ||
    modelName.includes("llama-3.1") ||
    modelName.includes("llama-3.2") ||
    modelName.includes("llama-3.3") ||
    // Mistral models
    modelName.includes("mistral") ||
    modelName.includes("mixtral") ||
    // Other known tool-capable models
    modelName.includes("command-r") ||
    modelName.includes("firefunction");
  
  const supportsTools = supportsToolCalling;

  // For Ollama models, add explicit tool schemas to system prompt
  // because ollama-ai-provider-v2 might not format them correctly
  const explicitToolDocs = isOllamaModel && supportsToolCalling ? `

**AVAILABLE FUNCTIONS:**

You have access to these function calling tools:

1. READ_MCP
   - Description: Read details about an available integration and its tools
   - Parameters: { name: string } (integration name)
   - Use this to discover what tools an integration provides

2. CALL_TOOL  
   - Description: Execute a specific tool from an integration
   - Parameters: { integrationId: string, tool: string, arguments: object }
   - Use this to call any tool like creating views, reading data, etc.

To use a tool, format your response with proper function calling syntax.
` : null;

  const systemPrompt = [
    system, // User-provided instructions (if any)
    SYSTEM_PROMPT,
    supportsTools ? `Available integrations:\n${formatAvailableIntegrations(integrations)}` : null,
    supportsTools ? `Available tools:\n${formatAvailableTools(integrations, tools)}` : null,
    explicitToolDocs,
    !supportsTools ? "⚠️ Note: This model does not support tool calling. You can answer questions but cannot execute tools or access integrations." : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  // Create two tools (integrations_get and integrations_call_tool) only if supported
  const decopilotTools = supportsTools ? createDecopilotTools(ctx) : {};
  
  console.log("[decopilot-stream] Model supports tools:", supportsTools);
  console.log("[decopilot-stream] Tools created:", Object.keys(decopilotTools));

  // Get model instance, handling OpenRouter if enabled
  const llm = getModel(model.id, model.useOpenRouter, ctx);

  const onFinish = Promise.withResolvers<void>();

  // Prune messages to reduce context size
  const prunedMessages = pruneMessages({
    messages: modelMessages,
    reasoning: "before-last-message",
    emptyMessages: "remove",
    toolCalls: "none",
  }).slice(-maxWindowSize);

  const messagesToSend = [...contextMessages, ...prunedMessages];

  // Get abort signal from request to handle client disconnect
  const abortController = new AbortController();
  const requestSignal = c.req.raw.signal;
  
  // Listen for client disconnect and abort the stream
  requestSignal.addEventListener("abort", () => {
    console.log("[decopilot-stream] Client disconnected, aborting stream");
    abortController.abort();
    onFinish.resolve();
  }, { once: true });

  // Call streamText with validated and transformed parameters from Zod schema
  const stream = streamText({
    model: llm,
    messages: messagesToSend,
    // Only pass tools if model supports them
    ...(supportsTools && Object.keys(decopilotTools).length > 0 ? { tools: decopilotTools } : {}),
    system: systemPrompt,
    temperature,
    maxOutputTokens,
    stopWhen: [stepCountIs(maxStepCount)],
    abortSignal: abortController.signal,
    providerOptions: getProviderOptions({
      // 20% of the max output tokens as budget for thinking
      budgetTokens: Math.floor(maxOutputTokens * 0.2),
    }),
    // Compute on the background to avoid blocking the stream
    onFinish: (result) => {
      // Compute LLM usage asynchronously
      const usagePromise = wallet.computeLLMUsage({
        userId: ctx.user?.id as string | undefined,
        usage: result.usage as LanguageModelUsage,
        threadId: threadId ?? crypto.randomUUID(),
        model: model.id || DEFAULT_MODEL.id,
        modelId: model.id || DEFAULT_MODEL.id,
        workspace: ctx.workspace?.value as Workspace,
      });

      usagePromise
        .then(() => onFinish.resolve())
        .catch((error) => onFinish.reject(error));
    },
    onAbort: (args) => {
      console.log("[decopilot-stream] Stream aborted by model", args);
      onFinish.resolve();
    },
    onError: (error) => {
      console.error("[decopilot-stream] Error on stream", error);
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

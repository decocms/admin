import { AgentWallet, getProviderOptions, providers } from "@deco/ai";
import {
  CallToolResultSchema,
  DEFAULT_MAX_STEPS,
  DEFAULT_MAX_TOKENS,
  DEFAULT_MEMORY,
  DEFAULT_MODEL,
  formatIntegrationId,
  Integration,
  MAX_MAX_STEPS,
  MAX_MAX_TOKENS,
  WELL_KNOWN_MODELS,
  WellKnownMcpGroups,
} from "@deco/sdk";
import { PaymentRequiredError, UserInputError } from "@deco/sdk/errors";
import { PROJECT_TOOLS } from "@deco/sdk/mcp";
import { createWalletClient } from "@deco/sdk/mcp/wallet";
import type { Workspace } from "@deco/sdk/path";
import { createServerClient } from "@decocms/runtime/mcp-client";
import {
  isApiDecoChatMCPConnection,
  patchApiDecoChatTokenHTTPConnection,
} from "@deco/ai/mcp";
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
import { convertJsonSchemaToZod } from "zod-from-json-schema";
import { honoCtxToAppCtx } from "./api.ts";
import { WELL_KNOWN_AGENTS } from "./well_known_agents/index.ts";
import { WELL_KNOWN_DECOPILOT_AGENTS } from "@deco/sdk";
import { filterToolsForAgent } from "./tool-filter.ts";
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
  agentId: z.enum(["design", "code", "explore"]).optional().default("explore"), // Agent ID, defaults to explore
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
  // Find model in WELL_KNOWN_MODELS or use default
  const model =
    WELL_KNOWN_MODELS.find((m) => m.id === modelId) || DEFAULT_MODEL;

  // Parse provider and model name from "provider:model" format
  const [providerName, ...modelParts] = model.model.split(":");
  let modelName = modelParts.join(":");

  // Get provider config
  const provider = providers[providerName];
  if (!provider) {
    throw new Error(`Provider ${providerName} not supported`);
  }

  // Check if we should use OpenRouter
  const envVars = ctx.envVars as Record<string, string | undefined>;
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

    // Use the model name as-is for OpenRouter (e.g., "claude-sonnet-4.5")
    return openRouterProvider(`${providerName}/${modelName}`);
  }

  // Not using OpenRouter - use direct provider API
  // Map OpenRouter model names to native names if needed
  if (provider.mapOpenRouterModel?.[modelName]) {
    modelName = provider.mapOpenRouterModel[modelName];
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
  return providerFn(modelName);
}

/**
 * Helper to wrap tools from PROJECT_TOOLS (platform tools with direct handlers)
 */
function wrapProjectTools(
  ctx: ReturnType<typeof honoCtxToAppCtx>,
  toolNames: string[],
) {
  return toolNames.map((toolName) => {
    const toolSource = PROJECT_TOOLS.find((t) => t.name === toolName);
    if (!toolSource) {
      throw new Error(`Tool ${toolName} not found in PROJECT_TOOLS`);
    }

    // Unwrap lazy schemas if needed
    const inputSchema =
      toolSource.inputSchema instanceof z.ZodLazy
        ? toolSource.inputSchema._def.getter()
        : toolSource.inputSchema;
    const outputSchema = toolSource.outputSchema
      ? toolSource.outputSchema instanceof z.ZodLazy
        ? toolSource.outputSchema._def.getter()
        : toolSource.outputSchema
      : z.any();

    return tool({
      description: toolSource.description,
      inputSchema,
      outputSchema,
      execute: async (args: unknown) => {
        return await State.run(ctx, () => toolSource.handler(args as never));
      },
    });
  });
}

/**
 * Helper to wrap multiple tools from an MCP integration
 */
function wrapMcpTools(
  ctx: ReturnType<typeof honoCtxToAppCtx>,
  integration: Integration,
  toolMappings: Array<{ toolName: string; wrapperName: string }>,
) {
  if (!integration.tools || integration.tools.length === 0) {
    throw new Error(`Integration ${integration.id} has no tools`);
  }

  return toolMappings.map(({ toolName, wrapperName }) => {
    // Find the specific tool from integration.tools array
    const mcpTool = integration.tools!.find((t) => t.name === toolName);
    if (!mcpTool) {
      const availableToolNames = integration
        .tools!.map((t) => t.name)
        .slice(0, 10);
      throw new Error(
        `Tool ${toolName} not found in ${integration.id}. Available: ${availableToolNames.join(", ")}...`,
      );
    }

    // Convert JSON Schema to Zod for inputSchema and outputSchema
    let inputSchema: z.ZodTypeAny;
    let outputSchema: z.ZodTypeAny;

    try {
      inputSchema = mcpTool.inputSchema
        ? convertJsonSchemaToZod(mcpTool.inputSchema)
        : z.object({}).passthrough();
    } catch {
      inputSchema = z.object({}).passthrough();
    }

    try {
      outputSchema = mcpTool.outputSchema
        ? convertJsonSchemaToZod(mcpTool.outputSchema)
        : z.object({}).passthrough();
    } catch {
      outputSchema = z.object({}).passthrough();
    }

    // Use AI SDK's tool() function which handles Zod to JSON Schema conversion
    return tool({
      description: mcpTool.description || `Tool: ${wrapperName}`,
      inputSchema,
      outputSchema,
      execute: async (input: unknown) => {
        return await State.run(ctx, async () => {
          try {
            // Patch connection with cookie for API-based integrations
            let patchedConnection = integration.connection;
            if (isApiDecoChatMCPConnection(integration.connection)) {
              const cookie = ctx.cookie;
              patchedConnection = patchApiDecoChatTokenHTTPConnection(
                integration.connection,
                cookie,
              );
            }

            // Create MCP client from integration connection
            const client = await createServerClient({
              name: "decopilot-client",
              connection: patchedConnection,
            });

            if (!client) {
              throw new Error("Failed to create MCP client");
            }

            try {
              // Call the tool directly via MCP client
              const result = await client.callTool(
                {
                  name: toolName,
                  arguments:
                    typeof input === "object" && input !== null
                      ? (input as Record<string, unknown>)
                      : {},
                },
                // @ts-expect-error - Zod version conflict between packages
                CallToolResultSchema,
                { timeout: 300000 },
              );

              // Extract structured content or content from result
              if (result.structuredContent) {
                return result.structuredContent;
              }
              if (result.content && Array.isArray(result.content)) {
                return result.content;
              }
              return result;
            } finally {
              // Always close the client to avoid leaks
              await client.close();
            }
          } catch (error) {
            console.error(
              `[DECOPILOT] MCP tool ${wrapperName} execution error`,
              {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                integrationId: integration.id,
                toolName,
              },
            );
            throw error;
          }
        });
      },
    });
  });
}

/**
 * Create all decopilot tools as wrappers around MCP tools
 * Tools come from either PROJECT_TOOLS (for platform tools) or MCP integrations (for resource tools)
 */
const createDecopilotTools = async (
  ctx: ReturnType<typeof honoCtxToAppCtx>,
  integrations: Integration[],
) => {
  // Get integration IDs for MCP integrations
  const [
    toolsIntegrationId,
    workflowsIntegrationId,
    viewsIntegrationId,
    documentsIntegrationId,
  ] = [
    formatIntegrationId(WellKnownMcpGroups.Tools),
    formatIntegrationId(WellKnownMcpGroups.Workflows),
    formatIntegrationId(WellKnownMcpGroups.Views),
    formatIntegrationId(WellKnownMcpGroups.Documents),
  ];

  // Find integrations
  const integrationMap = new Map<string, Integration>();

  const integrationIdsSet = new Set([
    toolsIntegrationId,
    workflowsIntegrationId,
    viewsIntegrationId,
    documentsIntegrationId,
  ]);

  for (const integration of integrations) {
    if (!integrationIdsSet.has(integration.id)) {
      continue;
    }
    integrationMap.set(integration.id, integration);
  }

  const [
    toolsIntegration,
    workflowsIntegration,
    viewsIntegration,
    documentsIntegration,
  ] = [
    toolsIntegrationId,
    workflowsIntegrationId,
    viewsIntegrationId,
    documentsIntegrationId,
  ].map((id) => {
    const i = integrationMap.get(id);
    if (!i) {
      throw new Error(`Integration ${id} not found`);
    }
    return i;
  });

  // MCP Management Tools (from PROJECT_TOOLS)
  const [readMcpTool, discoverMcpToolsTool] = wrapProjectTools(ctx, [
    "DECO_RESOURCE_MCP_READ",
    "DECO_RESOURCE_MCP_STORE_SEARCH",
  ]);

  // Code Execution Tool
  const [executeCodeTool] = wrapMcpTools(ctx, toolsIntegration, [
    { toolName: "DECO_TOOL_RUN_TOOL", wrapperName: "DECO_TOOL_RUN_TOOL" },
  ]);

  // Project MCP Tools - TOOL_* (from i:tools-management)
  const [
    toolCreateTool,
    toolReadTool,
    toolUpdateTool,
    toolDeleteTool,
    toolSearchTool,
  ] = wrapMcpTools(ctx, toolsIntegration, [
    {
      toolName: "DECO_RESOURCE_TOOL_CREATE",
      wrapperName: "DECO_RESOURCE_TOOL_CREATE",
    },
    {
      toolName: "DECO_RESOURCE_TOOL_READ",
      wrapperName: "DECO_RESOURCE_TOOL_READ",
    },
    {
      toolName: "DECO_RESOURCE_TOOL_UPDATE",
      wrapperName: "DECO_RESOURCE_TOOL_UPDATE",
    },
    {
      toolName: "DECO_RESOURCE_TOOL_DELETE",
      wrapperName: "DECO_RESOURCE_TOOL_DELETE",
    },
    {
      toolName: "DECO_RESOURCE_TOOL_SEARCH",
      wrapperName: "DECO_RESOURCE_TOOL_SEARCH",
    },
  ]);

  // Project MCP Tools - WORKFLOW_* (from i:workflows-management)
  const [
    workflowCreateTool,
    workflowReadTool,
    workflowUpdateTool,
    workflowDeleteTool,
    workflowSearchTool,
  ] = wrapMcpTools(ctx, workflowsIntegration, [
    {
      toolName: "DECO_RESOURCE_WORKFLOW_CREATE",
      wrapperName: "DECO_RESOURCE_WORKFLOW_CREATE",
    },
    {
      toolName: "DECO_RESOURCE_WORKFLOW_READ",
      wrapperName: "DECO_RESOURCE_WORKFLOW_READ",
    },
    {
      toolName: "DECO_RESOURCE_WORKFLOW_UPDATE",
      wrapperName: "DECO_RESOURCE_WORKFLOW_UPDATE",
    },
    {
      toolName: "DECO_RESOURCE_WORKFLOW_DELETE",
      wrapperName: "DECO_RESOURCE_WORKFLOW_DELETE",
    },
    {
      toolName: "DECO_RESOURCE_WORKFLOW_SEARCH",
      wrapperName: "DECO_RESOURCE_WORKFLOW_SEARCH",
    },
  ]);

  // Project MCP Tools - VIEW_* (from i:views-management)
  const [
    viewCreateTool,
    viewReadTool,
    viewUpdateTool,
    viewDeleteTool,
    viewSearchTool,
  ] = wrapMcpTools(ctx, viewsIntegration, [
    {
      toolName: "DECO_RESOURCE_VIEW_CREATE",
      wrapperName: "DECO_RESOURCE_VIEW_CREATE",
    },
    {
      toolName: "DECO_RESOURCE_VIEW_READ",
      wrapperName: "DECO_RESOURCE_VIEW_READ",
    },
    {
      toolName: "DECO_RESOURCE_VIEW_UPDATE",
      wrapperName: "DECO_RESOURCE_VIEW_UPDATE",
    },
    {
      toolName: "DECO_RESOURCE_VIEW_DELETE",
      wrapperName: "DECO_RESOURCE_VIEW_DELETE",
    },
    {
      toolName: "DECO_RESOURCE_VIEW_SEARCH",
      wrapperName: "DECO_RESOURCE_VIEW_SEARCH",
    },
  ]);

  // Project MCP Tools - DOCUMENT_* (from i:documents-management)
  const [
    documentCreateTool,
    documentReadTool,
    documentUpdateTool,
    documentSearchTool,
  ] = wrapMcpTools(ctx, documentsIntegration, [
    {
      toolName: "DECO_RESOURCE_DOCUMENT_CREATE",
      wrapperName: "DECO_RESOURCE_DOCUMENT_CREATE",
    },
    {
      toolName: "DECO_RESOURCE_DOCUMENT_READ",
      wrapperName: "DECO_RESOURCE_DOCUMENT_READ",
    },
    {
      toolName: "DECO_RESOURCE_DOCUMENT_UPDATE",
      wrapperName: "DECO_RESOURCE_DOCUMENT_UPDATE",
    },
    {
      toolName: "DECO_RESOURCE_DOCUMENT_SEARCH",
      wrapperName: "DECO_RESOURCE_DOCUMENT_SEARCH",
    },
  ]);

  return {
    // External MCP Tools
    DECO_RESOURCE_MCP_READ: readMcpTool,
    DECO_RESOURCE_MCP_STORE_SEARCH: discoverMcpToolsTool,

    // Code Execution
    DECO_TOOL_RUN_TOOL: executeCodeTool,

    // Project MCP Tools - TOOL_*
    DECO_RESOURCE_TOOL_CREATE: toolCreateTool,
    DECO_RESOURCE_TOOL_READ: toolReadTool,
    DECO_RESOURCE_TOOL_UPDATE: toolUpdateTool,
    DECO_RESOURCE_TOOL_DELETE: toolDeleteTool,
    DECO_RESOURCE_TOOL_SEARCH: toolSearchTool,

    // Project MCP Tools - WORKFLOW_*
    DECO_RESOURCE_WORKFLOW_CREATE: workflowCreateTool,
    DECO_RESOURCE_WORKFLOW_READ: workflowReadTool,
    DECO_RESOURCE_WORKFLOW_UPDATE: workflowUpdateTool,
    DECO_RESOURCE_WORKFLOW_DELETE: workflowDeleteTool,
    DECO_RESOURCE_WORKFLOW_SEARCH: workflowSearchTool,

    // Project MCP Tools - VIEW_*
    DECO_RESOURCE_VIEW_CREATE: viewCreateTool,
    DECO_RESOURCE_VIEW_READ: viewReadTool,
    DECO_RESOURCE_VIEW_UPDATE: viewUpdateTool,
    DECO_RESOURCE_VIEW_DELETE: viewDeleteTool,
    DECO_RESOURCE_VIEW_SEARCH: viewSearchTool,

    // Project MCP Tools - DOCUMENT_*
    DECO_RESOURCE_DOCUMENT_CREATE: documentCreateTool,
    DECO_RESOURCE_DOCUMENT_READ: documentReadTool,
    DECO_RESOURCE_DOCUMENT_UPDATE: documentUpdateTool,
    DECO_RESOURCE_DOCUMENT_SEARCH: documentSearchTool,
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
      `For MCP with id ${id}:\n${keys.join(",")}\n${tools.map((t) => keys.map((k) => JSON.stringify(t[k])).join(",")).join("\n")}`,
  );

  return availableTools.join("\n\n");
};

const PLATFORM_DESCRIPTION = `You are running on deco, a platform for building AI applications using the Model Context Protocol (MCP).

**Building Blocks:**
- **Tools:** Basic logic blocks with typed inputs/outputs. Can call other tools. Naming: RESOURCE_ACTION (TOOL_CREATE, DOCUMENT_READ).
- **Workflows:** Tools run step by step in the background.
- **Views:** Display tool outputs/inputs in a rich format for the user.
- **Documents:** Markdown storage to document the system, design docs, PRDs, searchable.
- **MCPs:** Tool creation and pack layer protocol. Marketplace integrations exposing tools. Installed MCPs' tools are available.

**Relationships:** Tools → Workflows (orchestrate) → Views (UI). Documents store planning. MCPs provide pre-built capabilities.`;

// Format nested [title, content] arrays into readable text

type FormattableLeaf = [string, string | null];
type FormattableNode = FormattableLeaf | [string, FormattableNode[]];

const format = (node: FormattableNode): string | null => {
  const [title, content] = node;

  if (typeof content === "string") {
    return `${title}\n\n${content}`;
  }

  if (!content) {
    return null;
  }

  return `${title}\n\n${content.map(format).filter(Boolean).join("\n\n")}`;
};

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
    agentId,
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

  // Get agent-specific system prompt from well-known agents
  const agentConfig = WELL_KNOWN_AGENTS[agentId];
  const agentPrompt = agentConfig?.systemPrompt ?? "";
  const agentName = WELL_KNOWN_DECOPILOT_AGENTS[agentId]?.name ?? "Assistant";

  // Create all decopilot tools (wrappers around MCP tools)
  const allDecopilotTools = await createDecopilotTools(ctx, integrations);

  // Filter tools based on agent
  const decopilotTools = filterToolsForAgent(allDecopilotTools, agentId);

  // Build structured system prompt with clear sections
  const systemPromptParts: FormattableNode[] = [
    [`You are ${agentName}`, agentPrompt || null],
    ["Platform Context", PLATFORM_DESCRIPTION || null],
    ["User Context", system || null],
    [
      "Installed MCPs in Workspace",
      [
        [
          "Note",
          "All tools from these MCPs are available for use. The MCPs listed below are installed in your workspace.",
        ],
        ["MCPs", formatAvailableIntegrations(integrations) || null],
      ],
    ],
    [
      "User-Added Tools",
      [
        [
          "Note",
          "These are tools manually added by the user. All tools from the installed MCPs above are also available.",
        ],
        ["Tools", formatAvailableTools(integrations, tools) || null],
      ],
    ],
  ];

  const systemPrompt = systemPromptParts
    .map(format)
    .filter(Boolean)
    .join("\n\n");

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

  // Call streamText with validated and transformed parameters from Zod schema
  const stream = streamText({
    model: llm,
    messages: messagesToSend,
    tools: decopilotTools,
    system: systemPrompt,
    temperature,
    maxOutputTokens,
    stopWhen: [stepCountIs(maxStepCount)],
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
      console.error("Abort on stream", args);
      onFinish.reject();
    },
    onError: (error) => {
      console.error("Error on stream", error);
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

  return stream.toUIMessageStreamResponse({
    // Add agentId and createdAt to each assistant message's metadata
    messageMetadata: () => ({
      agentId,
      createdAt: new Date().toISOString(),
    }),
  });
}

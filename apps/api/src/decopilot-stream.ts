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
import { getAgentSystemPrompt } from "./mode-prompts.ts";
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
  agentId: z.enum(["design", "code", "explore"]).optional().default("code"), // Agent ID, defaults to code
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
    const mcpTool = integration.tools!.find((t: any) => t.name === toolName);
    if (!mcpTool) {
      const availableToolNames = integration
        .tools!.map((t: any) => t.name)
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
    } catch (error) {
      inputSchema = z.object({}).passthrough();
    }

    try {
      outputSchema = mcpTool.outputSchema
        ? convertJsonSchemaToZod(mcpTool.outputSchema)
        : z.object({}).passthrough();
    } catch (error) {
      outputSchema = z.object({}).passthrough();
    }

    // Use AI SDK's tool() function which handles Zod to JSON Schema conversion
    return tool({
      description: mcpTool.description || `Tool: ${wrapperName}`,
      inputSchema,
      outputSchema,
      execute: async (input: any) => {
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
                { name: toolName, arguments: input },
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
    integrationManagementId,
    toolsIntegrationId,
    workflowsIntegrationId,
    viewsIntegrationId,
    documentsIntegrationId,
  ] = [
    formatIntegrationId(WellKnownMcpGroups.Integration),
    formatIntegrationId(WellKnownMcpGroups.Tools),
    formatIntegrationId(WellKnownMcpGroups.Workflows),
    formatIntegrationId(WellKnownMcpGroups.Views),
    formatIntegrationId(WellKnownMcpGroups.Documents),
  ];

  // Find integrations
  const integrationMap = new Map<string, Integration>();
  [
    integrationManagementId,
    toolsIntegrationId,
    workflowsIntegrationId,
    viewsIntegrationId,
    documentsIntegrationId,
  ].forEach((integrationId) => {
    const integration = integrations.find((i) => i.id === integrationId);
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }
    integrationMap.set(integrationId, integration);
  });

  const integrationManagement = integrationMap.get(integrationManagementId)!;
  const toolsIntegration = integrationMap.get(toolsIntegrationId)!;
  const workflowsIntegration = integrationMap.get(workflowsIntegrationId)!;
  const viewsIntegration = integrationMap.get(viewsIntegrationId)!;
  const documentsIntegration = integrationMap.get(documentsIntegrationId)!;

  // External MCP Tools (read installed integrations)
  const [readMcpTool, discoverMcpToolsTool, installMarketplaceTool] =
    wrapMcpTools(ctx, integrationManagement, [
      {
        toolName: "INTEGRATIONS_GET",
        wrapperName: "READ_MCP",
      },
      {
        toolName: "DECO_INTEGRATIONS_SEARCH",
        wrapperName: "DISCOVER_MCP_TOOLS",
      },
      {
        toolName: "DECO_INTEGRATION_INSTALL",
        wrapperName: "INSTALL_MARKETPLACE_INTEGRATION",
      },
    ]);

  // Code Execution Tool
  const [executeCodeTool] = wrapMcpTools(ctx, toolsIntegration, [
    { toolName: "DECO_TOOL_RUN_TOOL", wrapperName: "EXECUTE_CODE" },
  ]);

  // Project MCP Tools - TOOL_* (from i:tools-management)
  const [
    toolCreateTool,
    toolReadTool,
    toolUpdateTool,
    toolDeleteTool,
    toolSearchTool,
  ] = wrapMcpTools(ctx, toolsIntegration, [
    { toolName: "DECO_RESOURCE_TOOL_CREATE", wrapperName: "TOOL_CREATE" },
    { toolName: "DECO_RESOURCE_TOOL_READ", wrapperName: "TOOL_READ" },
    { toolName: "DECO_RESOURCE_TOOL_UPDATE", wrapperName: "TOOL_UPDATE" },
    { toolName: "DECO_RESOURCE_TOOL_DELETE", wrapperName: "TOOL_DELETE" },
    { toolName: "DECO_RESOURCE_TOOL_SEARCH", wrapperName: "TOOL_SEARCH" },
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
      wrapperName: "WORKFLOW_CREATE",
    },
    { toolName: "DECO_RESOURCE_WORKFLOW_READ", wrapperName: "WORKFLOW_READ" },
    {
      toolName: "DECO_RESOURCE_WORKFLOW_UPDATE",
      wrapperName: "WORKFLOW_UPDATE",
    },
    {
      toolName: "DECO_RESOURCE_WORKFLOW_DELETE",
      wrapperName: "WORKFLOW_DELETE",
    },
    {
      toolName: "DECO_RESOURCE_WORKFLOW_SEARCH",
      wrapperName: "WORKFLOW_SEARCH",
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
    { toolName: "DECO_RESOURCE_VIEW_CREATE", wrapperName: "VIEW_CREATE" },
    { toolName: "DECO_RESOURCE_VIEW_READ", wrapperName: "VIEW_READ" },
    { toolName: "DECO_RESOURCE_VIEW_UPDATE", wrapperName: "VIEW_UPDATE" },
    { toolName: "DECO_RESOURCE_VIEW_DELETE", wrapperName: "VIEW_DELETE" },
    { toolName: "DECO_RESOURCE_VIEW_SEARCH", wrapperName: "VIEW_SEARCH" },
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
      wrapperName: "DOCUMENT_CREATE",
    },
    {
      toolName: "DECO_RESOURCE_DOCUMENT_READ",
      wrapperName: "DOCUMENT_READ",
    },
    {
      toolName: "DECO_RESOURCE_DOCUMENT_UPDATE",
      wrapperName: "DOCUMENT_UPDATE",
    },
    {
      toolName: "DECO_RESOURCE_DOCUMENT_SEARCH",
      wrapperName: "DOCUMENT_SEARCH",
    },
  ]);

  return {
    // External MCP Tools
    READ_MCP: readMcpTool,
    DISCOVER_MCP_TOOLS: discoverMcpToolsTool,
    INSTALL_MARKETPLACE_INTEGRATION: installMarketplaceTool,

    // Code Execution
    EXECUTE_CODE: executeCodeTool,

    // Project MCP Tools - TOOL_*
    TOOL_CREATE: toolCreateTool,
    TOOL_READ: toolReadTool,
    TOOL_UPDATE: toolUpdateTool,
    TOOL_DELETE: toolDeleteTool,
    TOOL_SEARCH: toolSearchTool,

    // Project MCP Tools - WORKFLOW_*
    WORKFLOW_CREATE: workflowCreateTool,
    WORKFLOW_READ: workflowReadTool,
    WORKFLOW_UPDATE: workflowUpdateTool,
    WORKFLOW_DELETE: workflowDeleteTool,
    WORKFLOW_SEARCH: workflowSearchTool,

    // Project MCP Tools - VIEW_*
    VIEW_CREATE: viewCreateTool,
    VIEW_READ: viewReadTool,
    VIEW_UPDATE: viewUpdateTool,
    VIEW_DELETE: viewDeleteTool,
    VIEW_SEARCH: viewSearchTool,

    // Project MCP Tools - DOCUMENT_*
    DOCUMENT_CREATE: documentCreateTool,
    DOCUMENT_READ: documentReadTool,
    DOCUMENT_UPDATE: documentUpdateTool,
    DOCUMENT_SEARCH: documentSearchTool,
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

  // Get agent-specific system prompt
  let agentPrompt: string;
  let allDecopilotTools: Record<string, any>;
  let decopilotTools: Record<string, any>;

  try {
    agentPrompt = getAgentSystemPrompt(agentId);

    // Create all decopilot tools (wrappers around MCP tools)
    allDecopilotTools = await createDecopilotTools(ctx, integrations);

    // Filter tools based on agent
    decopilotTools = filterToolsForAgent(allDecopilotTools, agentId);
  } catch (error) {
    console.error("[DECOPILOT] Error creating tools", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      agentId,
    });
    throw error;
  }

  const systemPrompt = [
    system, // User-provided instructions (if any)
    SYSTEM_PROMPT,
    agentPrompt, // Agent-specific instructions
    `Available integrations:\n${formatAvailableIntegrations(integrations)}`,
    `Available tools:\n${formatAvailableTools(integrations, tools)}`,
  ]
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
    // Add agentId to each assistant message's metadata
    messageMetadata: () => ({ agentId }),
  });
}

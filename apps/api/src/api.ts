import { createServerClient } from "@deco/ai/mcp";
import { HttpServerTransport } from "@deco/mcp/http";
import {
  DECO_CMS_WEB_URL,
  formatIntegrationId,
  Locator,
  MCPConnection,
  ProjectLocator,
  WellKnownMcpGroups,
} from "@deco/sdk";
import { DECO_CHAT_KEY_ID, getKeyPair } from "@deco/sdk/auth";
import {
  AGENT_TOOLS,
  assertWorkspaceResourceAccess,
  CallToolMiddleware,
  compose,
  CONTRACTS_TOOLS,
  createDeconfigClientForContext,
  createDocumentResourceV2Implementation,
  createDocumentViewsV2,
  createMCPToolsStub,
  createToolBindingImpl,
  createToolResourceV2Implementation,
  createToolViewsV2,
  createViewResourceV2Implementation,
  createViewViewsV2,
  createWorkflowBindingImpl,
  createWorkflowResourceV2Implementation,
  createWorkflowRunsResourceV2Implementation,
  createWorkflowViewsV2,
  DECONFIG_TOOLS,
  EMAIL_TOOLS,
  getIntegration,
  getPresignedReadUrl_WITHOUT_CHECKING_AUTHORIZATION,
  getRegistryApp,
  getWorkspaceBucketName,
  GLOBAL_TOOLS,
  type IntegrationWithTools,
  documentViews as legacyDocumentViews,
  viewViews as legacyViewViews,
  workflowViews as legacyWorkflowViews,
  ListToolsMiddleware,
  PrincipalExecutionContext,
  PROJECT_TOOLS,
  runTool,
  toBindingsContext,
  Tool,
  ToolBindingImplOptions,
  type ToolLike,
  watchSSE,
  withMCPAuthorization,
  withMCPErrorHandling,
  WithTool,
  WorkflowBindingImplOptions,
  wrapToolFn,
} from "@deco/sdk/mcp";
import { getApps, getGroupByAppName } from "@deco/sdk/mcp/groups";
import { executeTool } from "@deco/sdk/mcp/tools/api";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";
import { type Context, Hono } from "hono";
import { env, getRuntimeKey } from "hono/adapter";
import { HTTPException } from "hono/http-exception";
import { cors } from "hono/cors";
import { endTime, startTime } from "hono/timing";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { studio } from "outerbase-browsable-do-enforced";
import { z } from "zod";
import { convertJsonSchemaToZod } from "zod-from-json-schema";
import { ROUTES as loginRoutes } from "./auth/index.ts";
import { withActorsStubMiddleware } from "./middlewares/actors-stub.ts";
import { withActorsMiddleware } from "./middlewares/actors.ts";
import { withContextMiddleware } from "./middlewares/context.ts";
import { loggerMiddleware } from "./middlewares/logger.ts";
import { setUserMiddleware } from "./middlewares/user.ts";
import { handleCodeExchange } from "./oauth/code.ts";
import { type AppContext, type AppEnv, State } from "./utils/context.ts";
import { handleStripeWebhook } from "./webhooks/stripe.ts";
import { handleTrigger } from "./webhooks/trigger.ts";

export const app = new Hono<AppEnv>();

const contextToPrincipalExecutionContext = (
  c: Context<AppEnv>,
): PrincipalExecutionContext => {
  let inputOrg =
    c.req.param("org") ?? c.req.param("root") ?? c.req.query("org");
  let inputProject =
    c.req.param("project") ?? c.req.param("slug") ?? c.req.query("project");

  const user = c.get("user");
  const userAud =
    user && typeof user === "object" && "aud" in user ? user.aud : undefined;

  // set org and project based on user aud
  if (!inputOrg && !inputProject && typeof userAud === "string") {
    const parsed = Locator.parse(userAud as ProjectLocator);
    inputOrg = parsed.org;
    inputProject = parsed.project;
  }

  const locator =
    inputOrg && inputProject
      ? Locator.from({ org: inputOrg, project: inputProject })
      : undefined;
  // Only use input org/project after parsing the locator,
  // ensuring that old clients accessing with /root/slug format
  // are adapted to the new locator format
  const structuredLocator = locator ? Locator.parse(locator) : undefined;
  const org = structuredLocator?.org as string;
  const project = structuredLocator?.project as string;

  const uid = user?.id as string | undefined;

  const oldWorkspaceValue = locator
    ? Locator.adaptToRootSlug(locator, uid)
    : undefined;

  const branch =
    c.req.param("branch") ??
    c.req.query("branch") ??
    c.req.header("x-deco-branch") ??
    "main";
  let ctxWorkspace = undefined;
  if (oldWorkspaceValue) {
    const [_, root, slug] = oldWorkspaceValue.split("/");
    ctxWorkspace = {
      branch,
      root,
      slug,
      value: oldWorkspaceValue,
    };
  }

  const ctxLocator = locator
    ? {
        org,
        project,
        value: locator,
        branch,
      }
    : undefined;
  const tokenQs = c.req.query("auth-token");
  return {
    ...c.var,
    params: { ...c.req.query(), ...c.req.param() },
    workspace: ctxWorkspace,
    locator: ctxLocator,
    cookie: c.req.header("Cookie"),
    // token issued by the MCP Proxy server to identify the caller as deco api
    proxyToken: c.req.header(PROXY_TOKEN_HEADER),
    callerApp: c.req.header("x-caller-app"),
    token: tokenQs ?? c.req.header("Authorization")?.split(" ")[1],
  };
};
export const honoCtxToAppCtx = (c: Context<AppEnv>): AppContext => {
  return {
    ...contextToPrincipalExecutionContext(c),
    ...toBindingsContext(env(c)),
  };
};

const mapMCPErrorToHTTPExceptionOrThrow = (err: Error) => {
  if ("code" in err) {
    // oxlint-disable-next-line no-explicit-any
    const cause = (err as any as { detail?: unknown }).detail;
    const status = (err.code as ContentfulStatusCode | undefined) ?? 500;
    const message = err.message ?? "Internal server error";
    throw new HTTPException(status, { message, cause });
  }

  throw err;
};

const getStoreSafe = () => {
  try {
    return State.getStore();
  } catch {
    return null;
  }
};

/**
 * Creates and sets up an MCP server for the given tools
 */
const createMCPHandlerFor = (
  tools:
    | readonly Tool[]
    | ((c: Context<AppEnv>) => Promise<Tool[] | readonly Tool[]>),
) => {
  return async (c: Context<AppEnv>) => {
    const group =
      c.req.query("group") ?? getGroupByAppName(c.req.param("group"));

    const server = new McpServer(
      { name: "@deco/api", version: "1.0.0" },
      { capabilities: { tools: {} } },
    );

    const registeredTools = new Set<string>();
    for (const tool of await (typeof tools === "function" ? tools(c) : tools)) {
      if (group && tool.group !== group) {
        continue;
      }

      if (registeredTools.has(tool.name)) {
        continue;
      }

      registeredTools.add(tool.name);

      const evalInputSchema =
        tool.inputSchema instanceof z.ZodLazy
          ? tool.inputSchema.schema
          : tool.inputSchema;

      const evalOutputSchema =
        tool.outputSchema instanceof z.ZodLazy
          ? tool.outputSchema.schema
          : tool.outputSchema;

      // Unwrap ZodEffects (from .refine(), .transform(), etc.) to get the base schema
      const unwrapSchema = (schema: z.ZodTypeAny): z.ZodTypeAny => {
        if (schema instanceof z.ZodEffects) {
          return unwrapSchema(schema.innerType());
        }
        return schema;
      };

      const baseInputSchema = unwrapSchema(evalInputSchema);
      const baseOutputSchema = unwrapSchema(evalOutputSchema);

      server.registerTool(
        tool.name,
        {
          annotations: tool.annotations,
          description: tool.description,
          inputSchema:
            "shape" in baseInputSchema
              ? (baseInputSchema.shape as z.ZodRawShape)
              : z.object({}).shape,
          outputSchema:
            baseOutputSchema && "shape" in baseOutputSchema
              ? (baseOutputSchema.shape as z.ZodRawShape)
              : z.object({}).shape,
        },
        // @ts-expect-error: zod shape is not typed
        withMCPErrorHandling(tool.handler, tool.name),
      );
    }

    const transport = new HttpServerTransport();

    startTime(c, "mcp-connect");
    await server.connect(transport);
    endTime(c, "mcp-connect");

    const parentContext = getStoreSafe();
    const currentContext = honoCtxToAppCtx(c);

    /**
     * Gives access to this tool if parent context has access
     *
     * To be able to remove this code, create a workflow that calls
     * ai-gateway to generate text with ai. If everything goes well
     * withtout the following code, you'll be able to remove the next code.
     *  */
    if (parentContext?.resourceAccess.granted()) {
      currentContext.resourceAccess.grant();
    }

    startTime(c, "mcp-handle-message");
    const res = await State.run(
      currentContext,
      transport.handleMessage.bind(transport),
      c.req.raw,
    );
    endTime(c, "mcp-handle-message");

    return res;
  };
};

/**
 * Setup a handler for handling tool calls. It's used so that
 * UIs can call the tools without suffering the serialization
 * of the protocol.
 */
const createToolCallHandlerFor = <
  TDefinition extends readonly ToolLike[] = readonly ToolLike[],
>(
  toolsOrToolsFn: TDefinition | ((ctx: Context) => Promise<TDefinition>),
) => {
  const getToolsMap: (
    ctx: Context,
  ) => Promise<Map<string, ToolLike>> | Map<string, ToolLike> =
    typeof toolsOrToolsFn === "function"
      ? async (c: Context) => {
          const tools = await toolsOrToolsFn(c);
          return new Map(tools.map((t) => [t.name, t]));
        }
      : () => new Map(toolsOrToolsFn.map((t) => [t.name, t]));

  return async (c: Context) => {
    const toolMap = await getToolsMap(c);
    const tools = Array.from(toolMap.values());
    const client = createMCPToolsStub({ tools });
    const tool = c.req.param("tool");
    const args = await c.req.json();

    const t = toolMap.get(tool as TDefinition[number]["name"]);
    if (!t) {
      throw new HTTPException(404, { message: "Tool not found" });
    }
    const { data, error } = t.inputSchema.safeParse(args);

    if (error || !data) {
      throw new HTTPException(400, {
        message: error?.message ?? "Invalid arguments",
      });
    }

    startTime(c, tool);
    const ctx = honoCtxToAppCtx(c);
    const toolFn = wrapToolFn(
      client[tool as TDefinition[number]["name"]] as (
        args: z.ZodType<TDefinition[number]["inputSchema"]>,
      ) => Promise<z.ZodType<TDefinition[number]["outputSchema"]>>,
      tool,
      ctx?.locator?.value,
    );

    const result = await State.run(ctx, (args) => toolFn(args), data).catch(
      mapMCPErrorToHTTPExceptionOrThrow,
    );
    endTime(c, tool);

    return c.json({ data: result });
  };
};

export interface EmitTokenOptions {
  tool: string;
}
interface ProxyOptions {
  tokenEmitter?: (options: EmitTokenOptions) => Promise<string>;
  headers?: Record<string, string>;
  tools?: ListToolsResult | null;
  middlewares?: Partial<{
    listTools: ListToolsMiddleware[];
    callTool: CallToolMiddleware[];
  }>;
}

const PROXY_TOKEN_HEADER = "x-deco-proxy-token";
const proxy = (
  mcpConnection: MCPConnection,
  { middlewares, tools, headers, tokenEmitter }: ProxyOptions = {},
) => {
  const createMcpClient = () => {
    const client = async (options?: EmitTokenOptions) => {
      return createServerClient(
        {
          connection: mcpConnection,
          name: "proxy",
        },
        undefined,
        {
          ...headers,
          ...(tokenEmitter && options
            ? { [PROXY_TOKEN_HEADER]: await tokenEmitter(options) }
            : {}),
        },
      );
    };

    const listTools = compose(
      ...(middlewares?.listTools ?? []),
      async () =>
        tools ??
        ((await (await client()).listTools()) as Awaited<
          ReturnType<ListToolsMiddleware>
        >),
    );

    const callTool = compose(...(middlewares?.callTool ?? []), async (req) => {
      return (
        await client({
          tool: req.params.name,
        })
      ).callTool(req.params, undefined, {
        timeout: 3000000,
      }) as ReturnType<CallToolMiddleware>;
    });

    return { listTools, callTool };
  };

  const fetch = async (req: Request) => {
    const { callTool, listTools } = await createMcpClient();
    const mcpServer = new McpServer(
      { name: "deco-chat-server", version: "1.0.0" },
      { capabilities: { tools: {} } },
    );
    const transport = new HttpServerTransport();

    await mcpServer.connect(transport);

    mcpServer.server.setRequestHandler(CallToolRequestSchema, (req) =>
      callTool(req),
    );
    mcpServer.server.setRequestHandler(ListToolsRequestSchema, (req) =>
      listTools(req),
    );

    return await transport.handleMessage(req);
  };

  return {
    fetch,
    callTool: async (
      ...args: Parameters<
        Awaited<ReturnType<typeof createMcpClient>>["callTool"]
      >
    ) => {
      const { callTool } = await createMcpClient();
      return callTool(...args);
    },
    listTools: async (
      ...args: Parameters<
        Awaited<ReturnType<typeof createMcpClient>>["listTools"]
      >
    ) => {
      const { listTools } = await createMcpClient();
      return listTools(...args);
    },
  };
};

const WELL_KNOWN_DECONFIG_TOOLS = [
  "READ_FILE",
  "LIST_FILES",
  "PUT_FILE",
  "DELETE_FILE",
  "LIST_BRANCHES",
  "DIFF_BRANCH",
]; // TODO: remove this once we have a better way to handle this; quick fix for now

const createMcpServerProxyForIntegration = async (
  c: Context,
  fetchIntegration: () => Promise<
    Pick<IntegrationWithTools, "connection" | "tools" | "id">
  >,
) => {
  const ctx = honoCtxToAppCtx(c);
  const callerApp = ctx.callerApp;

  const [integration, issuer] = await Promise.all([
    fetchIntegration(),
    ctx.jwtIssuer(),
  ]);

  const mcpServerProxy = proxy(integration.connection, {
    tokenEmitter: async (options) => {
      // Base policy for the requested tool
      const statements = [
        {
          effect: "allow" as const,
          resource: options.tool,
          matchCondition: {
            resource: "is_integration" as const,
            integrationId: integration.id,
          },
        },
      ];

      // Add DECONFIG file operation permissions for the same integration
      // These are needed when resource tools (like DECO_RESOURCE_*) internally call file operations
      for (const tool of WELL_KNOWN_DECONFIG_TOOLS) {
        statements.push({
          effect: "allow" as const,
          resource: tool,
          matchCondition: {
            resource: "is_integration" as const,
            integrationId: integration.id,
          },
        });
      }

      return await issuer.issue({
        sub: `proxy:${callerApp ?? crypto.randomUUID()}`,
        aud: ctx.locator?.value,
        iat: new Date().getTime(),
        exp: new Date(Date.now() + 1000 * 60).getTime(), //1 minute
        policies: [{ statements }],
      });
    },
    headers: callerApp ? { "x-caller-app": callerApp } : {},
    tools: integration.tools
      ? { tools: integration.tools as ListToolsResult["tools"] }
      : undefined,
    middlewares: {
      callTool: [withMCPAuthorization(ctx, { integrationId: integration.id })],
    },
  });

  return mcpServerProxy;
};

const createMcpServerProxyForAppName = (c: Context) => {
  const ctx = honoCtxToAppCtx(c);

  const appName = c.req.query("appName");
  const fetchIntegration = async () => {
    using _ = ctx.resourceAccess.grant();
    const integration = await State.run(ctx, () =>
      getRegistryApp.handler({ name: appName }),
    );

    return {
      ...integration,
      tools: integration.tools ?? [],
    };
  };

  return createMcpServerProxyForIntegration(c, fetchIntegration);
};
const createMcpServerProxy = (c: Context) => {
  const ctx = honoCtxToAppCtx(c);

  const integrationId = c.req.param("integrationId");
  const fetchIntegration = async () => {
    using _ = ctx.resourceAccess.grant();
    return await State.run(ctx, () =>
      getIntegration.handler({ id: integrationId }),
    );
  };

  return createMcpServerProxyForIntegration(c, () =>
    fetchIntegration().then((integration) => ({
      ...integration,
      id: integrationId,
    })),
  );
};

// Logger middleware with tool information highlighted
app.use(loggerMiddleware);

// Enable CORS for all routes on api.decocms.com and localhost
app.use(
  cors({
    origin: (origin) => origin,
    maxAge: 86400, // one day
    allowMethods: ["HEAD", "GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "Cookie",
      "Accept",
      "cache-control",
      "pragma",
      "x-trace-debug-id",
      "x-deno-isolate-instance-id",
      "mcp-protocol-version",
    ],
    exposeHeaders: [
      "Content-Type",
      "Authorization",
      "Set-Cookie",
      "x-trace-debug-id",
    ],
    credentials: true,
  }),
);

app.use(withContextMiddleware);
app.use(setUserMiddleware);
app.use(withActorsStubMiddleware);

// copy immutable responses to allow workerd to change its headers.
app.use(async (c, next) => {
  await next();

  if (c.var.immutableRes && getRuntimeKey() === "workerd") {
    c.res = new Response(c.res.body, c.res);
  }
});

app.use(withActorsMiddleware);

const contractsMcpHandler = createMCPHandlerFor(CONTRACTS_TOOLS);
app.post(`/contracts/mcp`, contractsMcpHandler);
app.post(`/contracts/mcp/tool/:toolName`, contractsMcpHandler);

const deconfigMcpHandler = createMCPHandlerFor(DECONFIG_TOOLS);
app.post(`/deconfig/mcp`, deconfigMcpHandler);
app.post(`/deconfig/mcp/tool/:toolName`, deconfigMcpHandler);
app.get(`/:org/:project/deconfig/watch`, async (ctx) => {
  const appCtx = honoCtxToAppCtx(ctx);
  return await watchSSE(appCtx, {
    branchName: ctx.req.query("branch") ?? ctx.req.query("branchName"),
    pathFilters:
      ctx.req.query("path-filter") ??
      ctx.req.query("path-filters") ??
      ctx.req.query("pathFilter"),
    fromCtime: +(
      ctx.req.query("from-ctime") ??
      ctx.req.query("fromCtime") ??
      "1"
    ),
    watcherId: ctx.req.query("watcher-id"),
  });
});

const globalMcpHandler = createMCPHandlerFor(GLOBAL_TOOLS);
app.all("/mcp", globalMcpHandler);
app.all("/mcp/tool/:toolName", globalMcpHandler);

app.get("/mcp/groups", (ctx) => {
  return ctx.json(getApps());
});

const createContextBasedTools = (ctx: Context) => {
  const appCtx = honoCtxToAppCtx(ctx);
  const client = createDeconfigClientForContext(appCtx);

  // Create Resources 2.0 tool resource implementation
  const toolResourceV2 = createToolResourceV2Implementation(
    client,
    formatIntegrationId(WellKnownMcpGroups.Tools),
  );

  // Create Resources 2.0 workflow resource implementation
  const workflowResourceV2 = createWorkflowResourceV2Implementation(
    client,
    formatIntegrationId(WellKnownMcpGroups.Workflows),
  );

  // Create Resources 2.0 workflow runs resource implementation
  const workflowRunsResourceV2 = createWorkflowRunsResourceV2Implementation(
    client,
    formatIntegrationId(WellKnownMcpGroups.Workflows),
  );

  // Create Resources 2.0 document resource implementation
  const documentResourceV2 = createDocumentResourceV2Implementation(
    client,
    formatIntegrationId(WellKnownMcpGroups.Documents),
  );

  // Create Resources 2.0 view resource implementation
  const viewResourceV2 = createViewResourceV2Implementation(
    client,
    formatIntegrationId(WellKnownMcpGroups.Views),
  );

  const resourcesClient = createMCPToolsStub({
    tools: [
      ...toolResourceV2,
      ...workflowResourceV2,
      ...workflowRunsResourceV2,
      ...documentResourceV2,
      ...viewResourceV2,
    ],
    context: appCtx,
  });

  const resourceToolRead: ToolBindingImplOptions["resourceToolRead"] = ((uri) =>
    State.run(
      appCtx,
      async () => await resourcesClient.DECO_RESOURCE_TOOL_READ({ uri }),
    )) as ToolBindingImplOptions["resourceToolRead"];

  // Create tool execution functionality using createToolBindingImpl
  const callTool = createToolBindingImpl({ resourceToolRead });

  // Create Views 2.0 implementation for tool views
  const toolViewsV2 = createToolViewsV2();

  const resourceWorkflowRead: WorkflowBindingImplOptions["resourceWorkflowRead"] =
    ((uri) =>
      State.run(
        appCtx,
        async () => await resourcesClient.DECO_RESOURCE_WORKFLOW_READ({ uri }),
      )) as WorkflowBindingImplOptions["resourceWorkflowRead"];

  const resourceWorkflowUpdate: WorkflowBindingImplOptions["resourceWorkflowUpdate"] =
    ((uri, data) =>
      State.run(
        appCtx,
        async () =>
          await resourcesClient.DECO_RESOURCE_WORKFLOW_UPDATE({ uri, data }),
      )) as WorkflowBindingImplOptions["resourceWorkflowUpdate"];

  // Create workflow execution tools using createWorkflowBindingImpl
  const workflowBinding = createWorkflowBindingImpl({
    resourceWorkflowRead,
    resourceWorkflowUpdate,
  });

  // Create Views 2.0 implementation for workflow views
  const workflowViewsV2 = createWorkflowViewsV2();

  // Create Views 2.0 implementation for document views
  const documentViewsV2 = createDocumentViewsV2();

  // Create Views 2.0 implementation for view views
  const viewViewsV2 = createViewViewsV2();

  // Create legacy workflow views for backward compatibility

  const workflowTools = [
    ...workflowResourceV2, // Add new Resources 2.0 implementation
    ...workflowRunsResourceV2, // Add runs resource implementation
    ...workflowBinding, // Add workflow execution tools
    ...workflowViewsV2, // Add Views 2.0 implementation
    ...legacyWorkflowViews, // Add legacy workflow views
  ].map((tool) => ({ ...tool, group: WellKnownMcpGroups.Workflows }));

  const toolsManagementTools = [
    ...toolResourceV2, // Add new Resources 2.0 implementation
    ...callTool, // Add tool execution functionality
    runTool,
    ...toolViewsV2, // Add Views 2.0 implementation
  ].map((tool) => ({ ...tool, group: WellKnownMcpGroups.Tools }));

  const documentsTools = [
    ...documentResourceV2, // Add new Resources 2.0 implementation
    ...documentViewsV2, // Add Views 2.0 implementation
    ...legacyDocumentViews, // Add legacy document views
  ].map((tool) => ({ ...tool, group: WellKnownMcpGroups.Documents }));

  const viewsTools = [
    ...viewResourceV2, // Add new Resources 2.0 implementation
    ...viewViewsV2, // Add Views 2.0 implementation
    ...legacyViewViews, // Add legacy view views
  ].map((tool) => ({ ...tool, group: WellKnownMcpGroups.Views }));

  return [
    ...workflowTools,
    ...toolsManagementTools,
    ...documentsTools,
    ...viewsTools,
  ];
};

app.all(
  "/mcp/:group",
  createMCPHandlerFor(async (ctx) => {
    const group = getGroupByAppName(ctx.req.param("group"));
    const tools = await projectTools(ctx);

    const found = tools.filter((tool) => tool.group === group);
    if (found.length > 0) {
      return found;
    }

    return GLOBAL_TOOLS.filter((tool) => tool.group === group);
  }),
);

const projectTools = (ctx: Context) => {
  return Promise.resolve([...PROJECT_TOOLS, ...createContextBasedTools(ctx)]);
};

const createSelfTools = async (ctx: Context) => {
  const appCtx = honoCtxToAppCtx(ctx);
  const client = createDeconfigClientForContext(appCtx);

  // 1. Get all custom tools using DECO_RESOURCE_TOOL_SEARCH
  const toolResourceV2 = createToolResourceV2Implementation(
    client,
    formatIntegrationId(WellKnownMcpGroups.Tools),
  );

  const toolsResourceClient = createMCPToolsStub({
    tools: toolResourceV2,
    context: appCtx,
  });

  const customToolsResult = await State.run(
    appCtx,
    async () =>
      await toolsResourceClient.DECO_RESOURCE_TOOL_SEARCH({ query: "" }),
  );

  // 2. Read each tool's full definition (search only returns metadata)
  const toolsWithFullData = await Promise.all(
    (
      customToolsResult as {
        items: Array<{
          id: string;
          uri: string;
          description: string;
          data: unknown;
        }>;
      }
    ).items.map(async (toolUri) => {
      const fullTool = await State.run(
        appCtx,
        async () =>
          await toolsResourceClient.DECO_RESOURCE_TOOL_READ({
            uri: toolUri.uri,
          }),
      );
      return fullTool;
    }),
  );

  // 3. Transform custom tools into executable tools
  const customTools = toolsWithFullData.map((toolResult: unknown) => {
    // @ts-expect-error - Typings not really working, but this is fine
    const toolData = toolResult.data;

    // Convert JSON Schema to Zod for proper UI rendering
    const inputSchema = convertJsonSchemaToZod(toolData.inputSchema);
    const outputSchema = convertJsonSchemaToZod(toolData.outputSchema);

    // Create a tool that executes the custom tool
    return {
      name: toolData.name,
      description: toolData.description,
      inputSchema,
      outputSchema,
      handler: async (input) => {
        await assertWorkspaceResourceAccess(appCtx, "DECO_TOOL_CALL_TOOL");

        // Execute the tool without JSON schema validation (already validated by MCP layer via Zod schema)
        return await State.run(appCtx, async () => {
          const contextWithTool = {
            ...appCtx,
            tool: { name: toolData.name },
          } as unknown;

          if (!toolData.execute) {
            return {
              error: `Tool '${toolData.name}' is missing execute code`,
            };
          }

          const { result } = await executeTool(
            toolData,
            input,
            contextWithTool as WithTool<AppContext>,
            appCtx.token,
          );

          return result;
        });
      },
    } as Tool;
  });

  // 4. Get all workflows and create start tools
  const workflowResourceV2 = createWorkflowResourceV2Implementation(
    client,
    formatIntegrationId(WellKnownMcpGroups.Workflows),
  );

  const workflowsResourceClient = createMCPToolsStub({
    tools: workflowResourceV2,
    context: appCtx,
  });

  const workflowsResult = await State.run(
    appCtx,
    async () =>
      await workflowsResourceClient.DECO_RESOURCE_WORKFLOW_SEARCH({
        query: "",
      }),
  );

  // 5. Read each workflow's full definition (search only returns metadata)
  const workflowsWithFullData = await Promise.all(
    (
      workflowsResult as {
        items: Array<{
          id: string;
          uri: string;
          description: string;
          data: unknown;
        }>;
      }
    ).items.map(async (workflowUri) => {
      const fullWorkflow = await State.run(
        appCtx,
        async () =>
          await workflowsResourceClient.DECO_RESOURCE_WORKFLOW_READ({
            uri: workflowUri.uri,
          }),
      );
      return fullWorkflow;
    }),
  );

  // 6. Create workflow start tools (similar to packages/runtime/src/mastra.ts:416-442)
  const workflowTools = workflowsWithFullData.map((workflowResult: unknown) => {
    // @ts-expect-error - Typings not really working, but this is fine
    const workflow = workflowResult.data;

    // Convert the first step's inputSchema from JSON Schema to Zod
    // Note: The schema is at workflow.steps[0].def.inputSchema, not workflow.steps[0].inputSchema
    let firstStepInputSchema: z.ZodTypeAny = z.object({}).passthrough();
    if (workflow.steps?.[0]?.def?.inputSchema) {
      try {
        // Use convertJsonSchemaToZod to convert JSON Schema to Zod
        firstStepInputSchema = convertJsonSchemaToZod(
          workflow.steps[0].def.inputSchema,
        );
      } catch (e) {
        // If there's any error parsing, fall back to empty object
        console.error("[Self MCP] Error converting workflow input schema:", e);
        firstStepInputSchema = z.object({}).passthrough();
      }
    }

    return {
      name: `workflow_start_${workflow.name}`,
      description: workflow.description ?? `Start workflow ${workflow.name}`,
      inputSchema: firstStepInputSchema,
      outputSchema: z.object({
        runId: z.string(),
        uri: z.string(),
      }),
      handler: async (input: unknown) => {
        await assertWorkspaceResourceAccess(appCtx, "DECO_TOOL_CALL_TOOL");

        // Use DECO_WORKFLOW_START to start the workflow
        return await State.run(appCtx, async () => {
          const workflowBinding = createWorkflowBindingImpl({
            // @ts-expect-error - Typings not really working, but this is fine
            resourceWorkflowRead: (uri: string) =>
              State.run(
                appCtx,
                async () =>
                  await workflowsResourceClient.DECO_RESOURCE_WORKFLOW_READ({
                    uri,
                  }),
              ),
            // @ts-expect-error - Typings not really working, but this is fine
            resourceWorkflowUpdate: (uri: string, data: unknown) =>
              State.run(
                appCtx,
                async () =>
                  await workflowsResourceClient.DECO_RESOURCE_WORKFLOW_UPDATE({
                    uri,
                    data,
                  }),
              ),
          });

          const startTool = workflowBinding.find(
            (t) => t.name === "DECO_WORKFLOW_START",
          );
          if (!startTool) {
            throw new Error("DECO_WORKFLOW_START tool not found");
          }
          return await startTool.handler({
            // @ts-expect-error - Typings not really working, but this is fine
            uri: workflowResult.uri,
            // @ts-expect-error - Typings not really working, but this is fine
            input: input,
          });
        });
      },
    } as Tool;
  });

  return [...customTools, ...workflowTools];
};

const projectMcpHandler = createMCPHandlerFor(projectTools);
app.all("/:org/:project/mcp", projectMcpHandler);
app.all("/:org/:project/mcp/tool/:toolName", projectMcpHandler);

const agentMcpHandler = createMCPHandlerFor(AGENT_TOOLS);
app.all("/:org/:project/agents/:agentId/mcp", agentMcpHandler);
app.all("/:org/:project/agents/:agentId/mcp/tool/:toolName", agentMcpHandler);

// Tool call endpoint handlers
const globalToolCallHandler = createToolCallHandlerFor(GLOBAL_TOOLS);
app.post("/tools/call/:tool", globalToolCallHandler);

const projectToolCallHandler = createToolCallHandlerFor(projectTools);
app.post("/:org/:project/tools/call/:tool", projectToolCallHandler);

const emailMcpHandler = createMCPHandlerFor(EMAIL_TOOLS);
app.post(`/:org/:project/${WellKnownMcpGroups.Email}/mcp`, emailMcpHandler);
app.post(
  `/:org/:project/${WellKnownMcpGroups.Email}/mcp/tool/:toolName`,
  emailMcpHandler,
);

const selfMcpHandler = createMCPHandlerFor(createSelfTools);
app.post("/:org/:project/self/mcp", selfMcpHandler);
app.post("/:org/:project/self/mcp/tool/:toolName", selfMcpHandler);

app.post("/:org/:project/:integrationId/mcp", async (c) => {
  const mcpServerProxy = await createMcpServerProxy(c);

  return mcpServerProxy.fetch(c.req.raw);
});
app.post("/:org/:project/:integrationId/mcp/tool/:toolName", async (c) => {
  const mcpServerProxy = await createMcpServerProxy(c);

  return mcpServerProxy.fetch(c.req.raw);
});

app.post("/:org/:project/:branch/:integrationId/mcp", async (c) => {
  const mcpServerProxy = await createMcpServerProxy(c);

  return mcpServerProxy.fetch(c.req.raw);
});
app.post(
  "/:org/:project/:branch/:integrationId/mcp/tool/:toolName",
  async (c) => {
    const mcpServerProxy = await createMcpServerProxy(c);

    return mcpServerProxy.fetch(c.req.raw);
  },
);

app.post("/apps/mcp", async (c) => {
  const mcpServerProxy = await createMcpServerProxyForAppName(c);

  return mcpServerProxy.fetch(c.req.raw);
});
app.post("/apps/mcp/tool/:toolName", async (c) => {
  const mcpServerProxy = await createMcpServerProxyForAppName(c);

  return mcpServerProxy.fetch(c.req.raw);
});

app.post("/:org/:project/:integrationId/tools/list", async (c) => {
  const mcpServerProxy = await createMcpServerProxy(c);

  return c.json(
    await mcpServerProxy.listTools({
      method: "tools/list" as const,
    }),
  );
});

app.all("/:org/:project/:integrationId/studio", async (c) => {
  const org = c.req.param("org");
  const project = c.req.param("project");
  const integrationId = c.req.param("integrationId");
  const isDefaultDb = integrationId === "i:databases-management";
  const ctx = honoCtxToAppCtx(c);
  const uid = ctx.user?.id as string | undefined;
  await assertWorkspaceResourceAccess(ctx, {
    resource: "DATABASES_RUN_SQL",
  });

  const locator = Locator.from({ org, project });
  const useLegacyWorkspace =
    project === "default" || project === "personal" || org === "users";
  const id = useLegacyWorkspace
    ? Locator.adaptToRootSlug(locator, uid)
    : locator;

  // The DO id can be overridden by the client, both on the URL
  // for GET requests and on the body "id" property for POST requests
  // i've forked the library to add the ability to enforce the id
  return studio(c.req.raw, ctx.workspaceDO, {
    disableHomepage: true,
    enforceId: isDefaultDb ? id : `${integrationId}-${id}`,
  });
});

app.post("/:org/:project/:integrationId/tools/call/:tool", async (c) => {
  const mcpServerProxy = await createMcpServerProxy(c);
  const tool = c.req.param("tool");

  const callToolParam = {
    method: "tools/call" as const,
    params: {
      name: tool,
      arguments: await c.req.json(),
    },
  };

  return c.json(await mcpServerProxy.callTool(callToolParam));
});

app.post(
  "/:org/:project/tools/call/agents/:agentId/:tool",
  createToolCallHandlerFor(AGENT_TOOLS),
);

app.post("/apps/code-exchange", handleCodeExchange);

app.post("/:org/:project/triggers/:id", handleTrigger);

// Login and auth routes
Object.entries(loginRoutes).forEach(([route, honoApp]) => {
  app.route(route, honoApp);
});

app.get("/files/:org/:project/:path{.+}", async (c) => {
  const org = c.req.param("org");
  const project = c.req.param("project");
  const filePath = c.req.param("path");

  if (!filePath) {
    throw new HTTPException(400, { message: "File path is required" });
  }

  const locator = Locator.from({ org, project });

  const appCtx = honoCtxToAppCtx(c);
  const uid = appCtx.user?.id as string | undefined;

  const bucketName = getWorkspaceBucketName(
    Locator.adaptToRootSlug(locator, uid),
  );
  const url = await getPresignedReadUrl_WITHOUT_CHECKING_AUTHORIZATION({
    c: appCtx,
    existingBucketName: bucketName,
    path: filePath,
    expiresIn: 3600,
  });

  const response = await fetch(url);

  if (response.status === 404) {
    throw new HTTPException(404, { message: "File not found" });
  }

  if (response.status === 403) {
    throw new HTTPException(403, { message: "Forbidden" });
  }

  if (response.status === 401) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  if (!response.body) {
    throw new HTTPException(404, { message: "File not found" });
  }

  return c.body(response.body, 200, {
    "Content-Type":
      response.headers.get("content-type") || "application/octet-stream",
  });
});

const getPublicKey = async (): Promise<JsonWebKey> => {
  const [publicKey] = await getKeyPair();
  return publicKey;
};
app.get("/.well-known/jwks.json", async () => {
  return Response.json({
    keys: [{ ...(await getPublicKey()), kid: DECO_CHAT_KEY_ID }],
  });
});
// External webhooks
app.post("/webhooks/stripe", handleStripeWebhook);

// Apps oauth
app.get("/apps/oauth", (c) => {
  const url = new URL(c.req.raw.url);
  const target = new URL(DECO_CMS_WEB_URL);
  target.pathname = "/apps-auth";
  target.search = url.search;

  return c.redirect(target.href);
});

// Health check endpoint
app.get("/health", (c: Context) => c.json({ status: "ok" }));

app.onError((err, c) => {
  const isHttpException = err instanceof HTTPException;
  return c.json(
    {
      error: err?.message ?? "Internal server error",
      name: err?.name ?? undefined,
      detail: isHttpException ? err.cause : err,
    },
    isHttpException ? err.status : 500,
  );
});

export default app;

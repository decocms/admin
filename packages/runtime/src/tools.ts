/* oxlint-disable no-explicit-any */
/* oxlint-disable ban-types */
import { HttpServerTransport } from "@deco/mcp/http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { DefaultEnv } from "./index.ts";
import { State } from "./state.ts";

export const createRuntimeContext = (prev?: AppContext) => {
  const store = State.getStore();
  if (!store) {
    if (prev) {
      return prev;
    }
    throw new Error("Missing context, did you forget to call State.bind?");
  }
  return store;
};

export interface ToolExecutionContext<
  TSchemaIn extends z.ZodTypeAny = z.ZodTypeAny,
> {
  context: z.infer<TSchemaIn>;
  runtimeContext: AppContext;
}
export interface Tool<
  TSchemaIn extends z.ZodTypeAny = z.ZodTypeAny,
  TSchemaOut extends z.ZodTypeAny | undefined = undefined,
> {
  id: string;
  description?: string;
  inputSchema: TSchemaIn;
  outputSchema?: TSchemaOut;
  execute: (
    context: ToolExecutionContext<TSchemaIn>,
  ) => TSchemaOut extends z.ZodSchema
    ? Promise<z.infer<TSchemaOut>>
    : Promise<any>;
}

/**
 * creates a private tool that always ensure for athentication before being executed
 */
export function createPrivateTool<
  TSchemaIn extends z.ZodSchema = z.ZodSchema,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
>(opts: Tool<TSchemaIn, TSchemaOut>): Tool<TSchemaIn, TSchemaOut> {
  const execute = opts.execute;
  if (typeof execute === "function") {
    opts.execute = (input: ToolExecutionContext<TSchemaIn>) => {
      const env = input.runtimeContext.env;
      if (env) {
        env.DECO_REQUEST_CONTEXT.ensureAuthenticated();
      }
      return execute(input);
    };
  }
  return createTool(opts);
}

export interface StreamableTool<TSchemaIn extends z.ZodSchema = z.ZodSchema> {
  id: string;
  inputSchema: TSchemaIn;
  streamable?: true;
  description?: string;
  execute: (input: ToolExecutionContext<TSchemaIn>) => Promise<Response>;
}

export function createStreamableTool<
  TSchemaIn extends z.ZodSchema = z.ZodSchema,
>(streamableTool: StreamableTool<TSchemaIn>): StreamableTool<TSchemaIn> {
  return {
    ...streamableTool,
    execute: (input: ToolExecutionContext<TSchemaIn>) => {
      const env = input.runtimeContext.env;
      if (env) {
        env.DECO_REQUEST_CONTEXT.ensureAuthenticated();
      }
      return streamableTool.execute({
        ...input,
        runtimeContext: createRuntimeContext(input.runtimeContext),
      });
    },
  };
}

export function createTool<
  TSchemaIn extends z.ZodSchema = z.ZodSchema,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
>(opts: Tool<TSchemaIn, TSchemaOut>): Tool<TSchemaIn, TSchemaOut> {
  return {
    ...opts,
    execute: (input: ToolExecutionContext<TSchemaIn>) => {
      return opts.execute({
        ...input,
        runtimeContext: createRuntimeContext(input.runtimeContext),
      });
    },
  };
}

export interface ViewExport {
  title: string;
  icon: string;
  url: string;
  tools?: string[];
  rules?: string[];
  installBehavior?: "none" | "open" | "autoPin";
}

export interface Integration {
  id: string;
  appId: string;
}
export type CreatedTool =
  | ReturnType<typeof createTool>
  | ReturnType<typeof createStreamableTool>;
export function isStreamableTool(tool: CreatedTool): tool is StreamableTool {
  return tool && "streamable" in tool && tool.streamable === true;
}
export interface CreateMCPServerOptions<
  Env = any,
  TSchema extends z.ZodTypeAny = never,
> {
  before?: (env: Env & DefaultEnv<TSchema>) => Promise<void> | void;
  oauth?: {
    state?: TSchema;
    scopes?: string[];
  };
  tools?:
    | Array<
        (
          env: Env & DefaultEnv<TSchema>,
        ) =>
          | Promise<CreatedTool>
          | CreatedTool
          | CreatedTool[]
          | Promise<CreatedTool[]>
      >
    | ((
        env: Env & DefaultEnv<TSchema>,
      ) => CreatedTool[] | Promise<CreatedTool[]>);
}

export type Fetch<TEnv = any> = (
  req: Request,
  env: TEnv,
  ctx: ExecutionContext,
) => Promise<Response> | Response;

export interface AppContext<TEnv = any> {
  env: TEnv;
  ctx: { waitUntil: (promise: Promise<any>) => void };
  req?: Request;
}

const decoChatOAuthToolsFor = <TSchema extends z.ZodTypeAny = never>({
  state: schema,
  scopes,
}: CreateMCPServerOptions<any, TSchema>["oauth"] = {}): ReturnType<
  typeof createTool<any, any>
>[] => {
  const jsonSchema = schema
    ? zodToJsonSchema(schema)
    : { type: "object", properties: {} };
  return [
    // MESH API support
    createTool({
      id: "MCP_CONFIGURATION",
      description: "MCP Configuration",
      inputSchema: z.object({}),
      outputSchema: z.object({
        stateSchema: z.any(),
        scopes: z.array(z.string()).optional(),
      }),
      execute: () => {
        return Promise.resolve({
          stateSchema: jsonSchema,
          scopes,
        });
      },
    }),
  ];
};

type CallTool = (opts: {
  toolCallId: string;
  toolCallInput: any;
}) => Promise<any>;

export type MCPServer<TEnv = any, TSchema extends z.ZodTypeAny = never> = {
  fetch: Fetch<TEnv & DefaultEnv<TSchema>>;
  callTool: CallTool;
};

export const createMCPServer = <
  TEnv = any,
  TSchema extends z.ZodTypeAny = never,
>(
  options: CreateMCPServerOptions<TEnv, TSchema>,
): MCPServer<TEnv, TSchema> => {
  const createServer = async (bindings: TEnv & DefaultEnv<TSchema>) => {
    await options.before?.(bindings);

    const server = new McpServer(
      { name: "@deco/mcp-api", version: "1.0.0" },
      { capabilities: { tools: {} } },
    );

    const toolsFn =
      typeof options.tools === "function"
        ? options.tools
        : async (bindings: TEnv & DefaultEnv<TSchema>) => {
            if (typeof options.tools === "function") {
              return await options.tools(bindings);
            }
            return await Promise.all(
              options.tools?.flatMap(async (tool) => {
                const toolResult = tool(bindings);
                const awaited = await toolResult;
                if (Array.isArray(awaited)) {
                  return awaited;
                }
                return [awaited];
              }) ?? [],
            ).then((t) => t.flat());
          };
    const tools = await toolsFn(bindings);

    tools.push(...decoChatOAuthToolsFor<TSchema>(options.oauth));

    for (const tool of tools) {
      server.registerTool(
        tool.id,
        {
          _meta: {
            streamable: isStreamableTool(tool),
          },
          description: tool.description,
          inputSchema:
            tool.inputSchema && "shape" in tool.inputSchema
              ? (tool.inputSchema.shape as z.ZodRawShape)
              : z.object({}).shape,
          outputSchema: isStreamableTool(tool)
            ? z.object({ bytes: z.record(z.string(), z.number()) }).shape
            : tool.outputSchema &&
                typeof tool.outputSchema === "object" &&
                "shape" in tool.outputSchema
              ? (tool.outputSchema.shape as z.ZodRawShape)
              : z.object({}).shape,
        },
        async (args) => {
          let result = await tool.execute!({
            context: args,
            runtimeContext: createRuntimeContext(),
          });

          if (isStreamableTool(tool) && result instanceof Response) {
            result = { bytes: await result.bytes() };
          }
          return {
            structuredContent: result,
            content: [
              {
                type: "text",
                text: JSON.stringify(result),
              },
            ],
          };
        },
      );
    }

    return { server, tools };
  };

  const fetch = async (
    req: Request,
    env: TEnv & DefaultEnv<TSchema>,
    _ctx: ExecutionContext,
  ) => {
    const { server } = await createServer(env);
    const transport = new HttpServerTransport();

    await server.connect(transport);

    return await transport.handleMessage(req);
  };

  const callTool: CallTool = async ({ toolCallId, toolCallInput }) => {
    const currentState = State.getStore();
    if (!currentState) {
      throw new Error("Missing state, did you forget to call State.bind?");
    }
    const env = currentState?.env;
    const { tools } = await createServer(env);
    const tool = tools.find((t) => t.id === toolCallId);
    const execute = tool?.execute;
    if (!execute) {
      throw new Error(
        `Tool ${toolCallId} not found or does not have an execute function`,
      );
    }

    return execute({
      context: toolCallInput,
      runtimeContext: createRuntimeContext(),
    });
  };

  return {
    fetch,
    callTool,
  };
};

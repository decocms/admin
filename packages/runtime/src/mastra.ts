// deno-lint-ignore-file no-explicit-any ban-types
import { HttpServerTransport } from "@deco/mcp/http";
import {
  createTool as mastraCreateTool,
  type Tool,
  type ToolAction,
  type ToolExecutionContext,
} from "@mastra/core";
import { RuntimeContext } from "@mastra/core/di";
import {
  createStep as mastraCreateStep,
  createWorkflow,
  type DefaultEngineType,
  type ExecuteFunction,
  type Step as MastraStep,
} from "@mastra/core/workflows";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod";
import { type DefaultEnv, withBindings } from "./index.ts";
export { createWorkflow };

export { cloneStep, cloneWorkflow } from "@mastra/core/workflows";

// this is dynamically imported to avoid deno check errors
// @ts-ignore: this is a valid import
const { env } = await import("cloudflare:workers");

const createRuntimeContext = (prev?: RuntimeContext<AppContext>) => {
  const runtimeContext = new RuntimeContext<AppContext>();
  const store = State.getStore();
  if (!store) {
    if (prev) {
      return prev;
    }
    throw new Error("Missing context, did you forget to call State.bind?");
  }
  const { env, ctx, req } = store;
  runtimeContext.set("env", env);
  runtimeContext.set("ctx", ctx);
  runtimeContext.set("req", req);
  return runtimeContext;
};
export function createTool<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
  TContext extends ToolExecutionContext<TSchemaIn> = ToolExecutionContext<
    TSchemaIn
  >,
  TExecute extends ToolAction<TSchemaIn, TSchemaOut, TContext>["execute"] =
  ToolAction<TSchemaIn, TSchemaOut, TContext>["execute"],
>(
  opts: ToolAction<TSchemaIn, TSchemaOut, TContext> & {
    execute?: TExecute;
  },
): [TSchemaIn, TSchemaOut, TExecute] extends
  [z.ZodSchema, z.ZodSchema, Function]
  ? Tool<TSchemaIn, TSchemaOut, TContext> & {
    inputSchema: TSchemaIn;
    outputSchema: TSchemaOut;
    execute: (context: TContext) => Promise<any>;
  }
  : Tool<TSchemaIn, TSchemaOut, TContext> {
  return mastraCreateTool({
    ...opts,
    execute: typeof opts?.execute === "function"
      ? ((input) => {
        return opts.execute!({
          ...input,
          runtimeContext: createRuntimeContext(input.runtimeContext),
        });
      }) as TExecute
      : opts.execute,
  });
}

export type ExecWithContext<TF extends (...args: any[]) => any> = (
  input: Omit<Parameters<TF>[0], "runtimeContext"> & {
    runtimeContext: RuntimeContext<AppContext>;
  },
) => ReturnType<TF>;

export interface Step<
  TStepId extends string = string,
  TSchemaIn extends z.ZodType<any> = z.ZodType<any>,
  TSchemaOut extends z.ZodType<any> = z.ZodType<any>,
  TResumeSchema extends z.ZodType<any> = z.ZodType<any>,
  TSuspendSchema extends z.ZodType<any> = z.ZodType<any>,
  TEngineType = any,
> extends
  Omit<
    MastraStep<
      TStepId,
      TSchemaIn,
      TSchemaOut,
      TResumeSchema,
      TSuspendSchema,
      TEngineType
    >,
    "execute"
  > {
  execute: ExecWithContext<
    ExecuteFunction<
      z.infer<TSchemaIn>,
      z.infer<TSchemaOut>,
      z.infer<TResumeSchema>,
      z.infer<TSuspendSchema>,
      TEngineType
    >
  >;
}
export function createStepFromTool<
  TSchemaIn extends z.ZodType<any>,
  TSchemaOut extends z.ZodType<any>,
  TContext extends ToolExecutionContext<TSchemaIn>,
>(
  tool: Tool<TSchemaIn, TSchemaOut, TContext> & {
    inputSchema: TSchemaIn;
    outputSchema: TSchemaOut;
    execute: (context: TContext) => Promise<any>;
  },
): Step<
  string,
  TSchemaIn,
  TSchemaOut,
  z.ZodType<any>,
  z.ZodType<any>,
  DefaultEngineType
> {
  return mastraCreateStep(tool);
}

export function createStep<
  TStepId extends string,
  TStepInput extends z.ZodType<any>,
  TStepOutput extends z.ZodType<any>,
  TResumeSchema extends z.ZodType<any>,
  TSuspendSchema extends z.ZodType<any>,
>(
  opts: {
    id: TStepId;
    description?: string;
    inputSchema: TStepInput;
    outputSchema: TStepOutput;
    resumeSchema?: TResumeSchema;
    suspendSchema?: TSuspendSchema;
    execute: ExecWithContext<
      ExecuteFunction<
        z.infer<TStepInput>,
        z.infer<TStepOutput>,
        z.infer<TResumeSchema>,
        z.infer<TSuspendSchema>,
        DefaultEngineType
      >
    >;
  },
): Step<
  TStepId,
  TStepInput,
  TStepOutput,
  TResumeSchema,
  TSuspendSchema,
  DefaultEngineType
> {
  return mastraCreateStep({
    ...opts,
    execute: (input) => {
      return opts.execute({
        ...input,
        runtimeContext: createRuntimeContext(input.runtimeContext),
      });
    },
  });
}

export interface CreateMCPServerOptions<Env = any, TSchema extends z.ZodTypeAny = never> {
  oauth?: { state?: TSchema };
  tools?: Array<(env: Env & DefaultEnv<TSchema>) => ReturnType<typeof createTool>>;
  workflows?: Array<(env: Env & DefaultEnv<TSchema>) => ReturnType<typeof createWorkflow>>;
}

export type Fetch<TEnv = any> = (
  req: Request,
  env: TEnv,
  ctx: ExecutionContext,
) => Promise<Response> | Response;

export interface AppContext<TEnv = any> {
  env: TEnv;
  ctx: { waitUntil: (promise: Promise<any>) => void };
  req: Request;
}

const asyncLocalStorage = new AsyncLocalStorage<AppContext | undefined>();

const State = {
  getStore: () => {
    return asyncLocalStorage.getStore();
  },
  run: <TEnv, R, TArgs extends unknown[]>(
    ctx: AppContext<TEnv>,
    f: (...args: TArgs) => R,
    ...args: TArgs
  ): R => asyncLocalStorage.run(ctx, f, ...args),
};

const decoChatOAuthToolFor = (schema: z.ZodTypeAny) => {
  return createTool({
    name: "DECO_CHAT_OAUTH_START",
    description: "OAuth for Deco Chat",
    inputSchema: schema,
    outputSchema: z.object({
      redirectUrl: z.string(),
    }),
    handler: async (args, c) => {
      const { redirectUrl } = await c.tool.execute(args);
      return { redirectUrl };
    },
  });
}

export const createMCPServer = <TEnv = any, TSchema extends z.ZodTypeAny = never>(
  options: CreateMCPServerOptions<TEnv, TSchema>,
): Fetch<TEnv & DefaultEnv<TSchema>> => {
  let server: McpServer | null = null;

  const createServer = () => {
    const server = new McpServer(
      { name: "@deco/mcp-api", version: "1.0.0" },
      { capabilities: { tools: {} } },
    );

    const bindings = withBindings<TEnv & DefaultEnv<TSchema>>(
      env as unknown as TEnv & DefaultEnv<TSchema>,
    );

    const tools = options.tools?.map((tool) => tool(bindings));
    const workflows = options.workflows?.map((workflow) => workflow(bindings));

    for (const tool of tools ?? []) {
      server.registerTool(
        tool.id,
        {
          description: tool.description,
          inputSchema: tool.inputSchema && "shape" in tool.inputSchema
            ? (tool.inputSchema.shape as z.ZodRawShape)
            : z.object({}).shape,
          outputSchema:
            tool.outputSchema && typeof tool.outputSchema === "object" &&
              "shape" in tool.outputSchema
              ? (tool.outputSchema.shape as z.ZodRawShape)
              : z.object({}).shape,
        },
        async (args) => {
          const result = await tool.execute!({
            context: args,
            runId: crypto.randomUUID(),
            runtimeContext: createRuntimeContext(),
          });
          return {
            structuredContent: result,
          };
        },
      );
    }

    for (const workflow of workflows ?? []) {
      server.registerTool(
        `DECO_CHAT_WORKFLOWS_START_${workflow.id}`,
        {
          description: workflow.description,
          inputSchema: workflow.inputSchema && "shape" in workflow.inputSchema
            ? (workflow.inputSchema.shape as z.ZodRawShape)
            : z.object({}).shape,
          outputSchema: z.object({
            id: z.string(),
          }).shape,
        },
        async (args) => {
          // TODO (@mcandeia) how to ensure RUN_SQL is not available for all apps that wants to use workflows? is there any physical separation?
          const store = State.getStore();
          const runId = store?.req.headers.get("x-deco-chat-run-id") ??
            crypto.randomUUID();
          const workflowDO = bindings.DECO_CHAT_WORKFLOW_DO.get(
            bindings.DECO_CHAT_WORKFLOW_DO.idFromName(runId),
          );

          using result = await workflowDO.start({
            workflowId: workflow.id,
            args,
            runId,
          });
          return {
            structuredContent: { runId: result.runId },
          };
        },
      );

      server.registerTool(
        `DECO_CHAT_WORKFLOWS_CANCEL_${workflow.id}`,
        {
          description: workflow.description,
          inputSchema: z.object({ runId: z.string() }).shape,
          outputSchema: z.object({ cancelled: z.boolean() }).shape,
        },
        async (args) => {
          const runId = args.runId;
          const workflowDO = bindings.DECO_CHAT_WORKFLOW_DO.get(
            bindings.DECO_CHAT_WORKFLOW_DO.idFromName(runId),
          );

          using _ = await workflowDO.cancel({
            workflowId: workflow.id,
            runId,
          });

          return {
            structuredContent: { cancelled: true },
          };
        },
      );

      server.registerTool(
        `DECO_CHAT_WORKFLOWS_RESUME_${workflow.id}`,
        {
          description: workflow.description,
          inputSchema: z.object({
            runId: z.string(),
            stepId: z.string(),
            resumeData: z.any(),
          }).shape,
          outputSchema: z.object({ resumed: z.boolean() }).shape,
        },
        async (args) => {
          const runId = args.runId;
          const workflowDO = bindings.DECO_CHAT_WORKFLOW_DO.get(
            bindings.DECO_CHAT_WORKFLOW_DO.idFromName(runId),
          );

          using _ = await workflowDO.resume({
            workflowId: workflow.id,
            runId,
            resumeData: args.resumeData,
            stepId: args.stepId,
          });

          return {
            structuredContent: { resumed: true },
          };
        },
      );
    }

    return server;
  };

  return async (req, env, ctx) => {
    server ||= createServer();
    const transport = new HttpServerTransport();

    await server.connect(transport);

    const res = await State.run(
      { env, ctx, req },
      transport.handleMessage.bind(transport),
      req,
    );

    return res;
  };
};

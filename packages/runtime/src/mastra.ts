// deno-lint-ignore-file no-explicit-any ban-types
import { HttpServerTransport } from "@deco/mcp/http";
import { D1Store } from "@mastra/cloudflare-d1";
import {
  createTool as mastraCreateTool,
  Mastra,
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

// this is dynamically imported to avoid deno check errors
const { env } = await import("cloudflare:workers");

const createRuntimeContext = () => {
  const runtimeContext = new RuntimeContext<AppContext>();
  const { env, ctx, req } = State.getStore();
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
          runtimeContext: createRuntimeContext(),
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
      return opts.execute({ ...input, runtimeContext: createRuntimeContext() });
    },
  });
}

export interface CreateMCPServerOptions<Env = any> {
  tools?: Array<(env: Env) => ReturnType<typeof createTool>>;
  workflows?: Array<(env: Env) => ReturnType<typeof createWorkflow>>;
}

export type Fetch<TEnv = any> = (
  req: Request,
  env: TEnv,
  ctx: ExecutionContext,
) => Promise<Response> | Response;

export interface AppContext<TEnv = any> {
  env: TEnv;
  ctx: ExecutionContext;
  req: Request;
}

const asyncLocalStorage = new AsyncLocalStorage<AppContext>();

const State = {
  getStore: () => {
    const store = asyncLocalStorage.getStore();

    if (!store) {
      throw new Error("Missing context, did you forget to call State.bind?");
    }

    return store;
  },
  run: <TEnv, R, TArgs extends unknown[]>(
    ctx: AppContext<TEnv>,
    f: (...args: TArgs) => R,
    ...args: TArgs
  ): R => asyncLocalStorage.run(ctx, f, ...args),
};

export const createMCPServer = <TEnv = any>(
  options: CreateMCPServerOptions<TEnv>,
): Fetch<TEnv> => {
  let server: McpServer | null = null;

  const createServer = () => {
    const server = new McpServer(
      { name: "@deco/mcp-api", version: "1.0.0" },
      { capabilities: { tools: {} } },
    );

    const bindings = withBindings<TEnv & DefaultEnv>(
      env as unknown as TEnv & DefaultEnv,
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

    const getMastraWorkflow = (
      workflow: NonNullable<typeof workflows>[number],
    ) => {
      const id = workflow.id;
      const mastra = new Mastra({
        storage: new D1Store({ client: bindings.DECO_CHAT_WORKSPACE_DB }),
        workflows: {
          [id]: workflow,
        },
      });

      return mastra.getWorkflow(id);
    };

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
          const { ctx, req } = State.getStore();
          const wkflow = getMastraWorkflow(workflow);

          const run = await wkflow.createRunAsync({
            runId: req.headers.get("x-deco-chat-run-id") ?? crypto.randomUUID(),
          });

          ctx.waitUntil(
            run.start({
              inputData: args,
              runtimeContext: createRuntimeContext(),
            }),
          );

          return {
            structuredContent: { id: run.runId },
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
          const wkflow = getMastraWorkflow(workflow);

          const run = await wkflow.createRunAsync({ runId: args.runId });

          await run.cancel();

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
          const { ctx } = State.getStore();
          const wkflow = getMastraWorkflow(workflow);

          const run = await wkflow.createRunAsync({ runId: args.runId });

          ctx.waitUntil(run.resume({
            resumeData: args.resumeData,
            step: args.stepId,
            runtimeContext: createRuntimeContext(),
          }));

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

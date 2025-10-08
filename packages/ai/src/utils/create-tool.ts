import { SpanStatusCode, trace } from "@deco/sdk/observability";
import { tool, type Tool, type ToolCallOptions } from "ai";
import type { z } from "zod";
import type { AIAgent, Env } from "../agent.ts";

export interface ToolOptions<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
> {
  id: string;
  description?: string;
  inputSchema?: TSchemaIn;
  outputSchema?: TSchemaOut;
  execute?: (
    agent: AIAgent,
    env?: Env,
  ) => (
    input: TSchemaIn extends z.ZodSchema ? z.infer<TSchemaIn> : never,
    options?: ToolCallOptions,
  ) => Promise<TSchemaOut extends z.ZodSchema ? z.infer<TSchemaOut> : unknown>;
}

export const createInnateTool: <
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
>(
  opts: ToolOptions<TSchemaIn, TSchemaOut>,
) => ToolOptions<TSchemaIn, TSchemaOut> = <
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
>(
  opts: ToolOptions<TSchemaIn, TSchemaOut>,
) => opts;

export const createTool = <Input, Output>(
  args: Tool<Input, Output> & { id: string },
) =>
  tool({
    ...args,
    execute: (ctx, options) => {
      const tracer = trace.getTracer("tool-tracer");

      return tracer.startActiveSpan(`TOOL@${args.id}`, async (span) => {
        let err: unknown | null = null;
        span.setAttribute("tool.id", args.id);

        try {
          return await args.execute?.(ctx, options);
        } catch (error) {
          err = error;
          throw error;
        } finally {
          if (err) {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message:
                typeof err === "object" && "message" in err
                  ? String(err.message)
                  : "Unknown error",
            });
          } else {
            span.setStatus({
              code: SpanStatusCode.OK,
            });
          }
          span.end();
        }
      });
    },
  });

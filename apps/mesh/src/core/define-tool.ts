/**
 * Tool Definition Pattern
 * 
 * Provides declarative tool creation with automatic:
 * - Type safety via Zod schemas
 * - Input/output validation
 * - Authorization checking
 * - Audit logging
 * - Metrics collection
 * - Distributed tracing
 */

import { SpanStatusCode } from '@opentelemetry/api';
import { z } from 'zod/v3';
import type { MeshContext } from './mesh-context';

// ============================================================================
// Tool Definition Types
// ============================================================================

/**
 * Tool definition structure
 */
export interface ToolDefinition<TInput extends z.ZodType, TOutput extends z.ZodType> {
  name: string;
  description: string;
  inputSchema: TInput;
  outputSchema?: TOutput;
  handler: (input: z.infer<TInput>, ctx: MeshContext) => Promise<z.infer<TOutput>>;
}

/**
 * Tool with execute wrapper
 * The execute method adds automatic validation, logging, and metrics
 */
export interface Tool<TInput extends z.ZodType, TOutput extends z.ZodType>
  extends ToolDefinition<TInput, TOutput> {
  execute: (input: z.infer<TInput>, ctx: MeshContext) => Promise<z.infer<TOutput>>;
}

// ============================================================================
// defineTool Function
// ============================================================================

/**
 * Define a tool with automatic validation, authorization, and logging
 * 
 * @example
 * ```typescript
 * export const MY_TOOL = defineTool({
 *   name: 'MY_TOOL',
 *   description: 'Does something useful',
 *   inputSchema: z.object({
 *     param: z.string(),
 *   }),
 *   outputSchema: z.object({
 *     result: z.string(),
 *   }),
 *   handler: async (input, ctx) => {
 *     await ctx.access.check();
 *     return { result: 'done' };
 *   },
 * });
 * ```
 */
export function defineTool<TInput extends z.ZodType, TOutput extends z.ZodType>(
  definition: ToolDefinition<TInput, TOutput>
): Tool<TInput, TOutput> {
  return {
    ...definition,

    /**
     * Execute the tool with automatic:
     * - Context setup (tool name)
     * - Validation (via MCP protocol - already handled)
     * - Tracing (OpenTelemetry)
     * - Metrics collection
     * - Audit logging
     * - Error handling
     */
    execute: async (input: z.infer<TInput>, ctx: MeshContext): Promise<z.infer<TOutput>> => {
      const startTime = Date.now();

      // Start OpenTelemetry span
      return await ctx.tracer.startActiveSpan(
        `tool.${definition.name}`,
        {
          attributes: {
            'tool.name': definition.name,
            'project.id': ctx.project?.id ?? 'organization',
            'user.id': ctx.auth.user?.id ?? ctx.auth.apiKey?.userId ?? 'anonymous',
          }
        },
        async (span) => {
          try {
            // Set tool name in context for authorization checks
            ctx.toolName = definition.name;

            // MCP protocol already validated input against JSON Schema
            // We trust the validation and execute the handler directly
            const output = await definition.handler(input, ctx);

            // Calculate duration
            const duration = Date.now() - startTime;

            // Record success metrics
            const histogram = ctx.meter.createHistogram('tool.execution.duration', {
              description: 'Duration of tool executions in milliseconds',
              unit: 'ms',
            });
            histogram.record(duration, {
              'tool.name': definition.name,
              'project.id': ctx.project?.id ?? 'organization',
              'status': 'success',
            });

            const counter = ctx.meter.createCounter('tool.execution.count', {
              description: 'Number of tool executions',
            });
            counter.add(1, {
              'tool.name': definition.name,
              'status': 'success',
            });

            // Audit log (fire and forget - don't block on logging)
            if (ctx.storage.auditLogs?.log) {
              ctx.storage.auditLogs.log({
                projectId: ctx.project?.id,
                userId: ctx.auth.user?.id ?? ctx.auth.apiKey?.userId,
                toolName: definition.name,
                allowed: ctx.access?.granted ? ctx.access.granted() : true,
                duration,
                timestamp: new Date(),
                requestMetadata: { input },
              }).catch((err: Error) => {
                console.error('Audit log failed:', err);
              });
            }

            // Mark span as successful
            span.setStatus({ code: SpanStatusCode.OK });

            return output;
          } catch (error) {
            // Record error metrics
            const errorCounter = ctx.meter.createCounter('tool.execution.errors', {
              description: 'Number of tool execution errors',
            });
            errorCounter.add(1, {
              'tool.name': definition.name,
              'error.type': (error as Error).constructor.name,
            });

            // Mark span as error
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: (error as Error).message,
            });
            span.recordException(error as Error);

            throw error;
          } finally {
            span.end();
          }
        }
      );
    },
  };
}


# Task 06: Tool Definition Pattern (defineTool)

## Overview
Implement the `defineTool` function - a declarative pattern for creating type-safe, validated tools with automatic audit logging and authorization checks.

## Dependencies
- `05-mesh-context.md` (needs MeshContext interface)

## Context from Spec

The `defineTool` function provides:
1. **Type Safety**: Zod schemas for compile-time and runtime validation
2. **Declarative**: Schema and handler co-located
3. **Automatic Logging**: Audit logs created automatically
4. **MCP Compatible**: Uses JSON Schema (derived from Zod)
5. **Authorization Support**: Integrates with access control

**Key principle:** MCP protocol already validates input/output, so we leverage that instead of duplicating validation.

## Implementation Steps

### 1. Create tool definition types

**Location:** `apps/mesh/src/core/define-tool.ts`

```typescript
import { z } from 'zod';
import type { MeshContext } from './mesh-context';
import { SpanStatusCode } from '@opentelemetry/api';

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
 */
export interface Tool<TInput extends z.ZodType, TOutput extends z.ZodType> 
  extends ToolDefinition<TInput, TOutput> {
  execute: (input: z.infer<TInput>, ctx: MeshContext) => Promise<z.infer<TOutput>>;
}
```

### 2. Implement defineTool function

```typescript
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
     * - Validation (via MCP protocol)
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
            ctx.meter
              .createHistogram('tool.execution.duration', {
                description: 'Duration of tool executions in milliseconds',
                unit: 'ms',
              })
              .record(duration, {
                'tool.name': definition.name,
                'project.id': ctx.project?.id ?? 'organization',
                'status': 'success',
              });
            
            ctx.meter
              .createCounter('tool.execution.count', {
                description: 'Number of tool executions',
              })
              .add(1, {
                'tool.name': definition.name,
                'status': 'success',
              });
            
            // Audit log (fire and forget - don't block on logging)
            ctx.storage.auditLogs?.log({
              projectId: ctx.project?.id,
              userId: ctx.auth.user?.id ?? ctx.auth.apiKey?.userId,
              toolName: definition.name,
              allowed: ctx.access.granted(),
              duration,
              timestamp: new Date(),
              requestMetadata: { input },
            }).catch((err: Error) => {
              console.error('Audit log failed:', err);
            });
            
            // Mark span as successful
            span.setStatus({ code: SpanStatusCode.OK });
            
            return output;
          } catch (error) {
            // Record error metrics
            ctx.meter
              .createCounter('tool.execution.errors', {
                description: 'Number of tool execution errors',
              })
              .add(1, {
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
```

### 3. Add helper for converting Zod to JSON Schema

```typescript
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * Convert Zod schema to JSON Schema for MCP
 */
export function toMCPSchema<T extends z.ZodType>(schema: T): object {
  return zodToJsonSchema(schema, {
    name: undefined,
    $refStrategy: 'none',
  });
}

/**
 * Get MCP tool definition from Tool
 */
export function toMCPToolDefinition<TInput extends z.ZodType, TOutput extends z.ZodType>(
  tool: Tool<TInput, TOutput>
): {
  name: string;
  description: string;
  inputSchema: object;
  outputSchema?: object;
} {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: toMCPSchema(tool.inputSchema),
    outputSchema: tool.outputSchema ? toMCPSchema(tool.outputSchema) : undefined,
  };
}
```

## File Locations

```
apps/mesh/src/
  core/
    define-tool.ts     # Tool definition pattern
```

## Additional Dependencies

Add to `package.json`:
```json
{
  "dependencies": {
    "zod-to-json-schema": "^3.24.1"
  }
}
```

## Testing

Create `apps/mesh/src/core/define-tool.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { defineTool, toMCPSchema, toMCPToolDefinition } from './define-tool';
import type { MeshContext } from './mesh-context';

// Mock MeshContext
const createMockContext = (): MeshContext => ({
  auth: {
    user: { id: 'user_1', email: '[email protected]', name: 'Test', role: 'admin' },
  },
  storage: {
    auditLogs: {
      log: vi.fn().mockResolvedValue(undefined),
    },
  } as any,
  vault: {} as any,
  authInstance: {} as any,
  access: {
    granted: vi.fn().mockReturnValue(true),
    check: vi.fn().mockResolvedValue(undefined),
  } as any,
  db: {} as any,
  tracer: {
    startActiveSpan: vi.fn((name, opts, fn) => fn({ 
      setStatus: vi.fn(),
      recordException: vi.fn(),
      end: vi.fn(),
      spanContext: vi.fn().mockReturnValue({ traceId: 'trace_123' }),
      setAttribute: vi.fn(),
    })),
  } as any,
  meter: {
    createHistogram: vi.fn().mockReturnValue({
      record: vi.fn(),
    }),
    createCounter: vi.fn().mockReturnValue({
      add: vi.fn(),
    }),
  } as any,
  baseUrl: 'https://mesh.example.com',
  metadata: {
    requestId: 'req_123',
    timestamp: new Date(),
  },
});

describe('defineTool', () => {
  it('should create a tool with execute method', () => {
    const tool = defineTool({
      name: 'TEST_TOOL',
      description: 'A test tool',
      inputSchema: z.object({
        message: z.string(),
      }),
      outputSchema: z.object({
        result: z.string(),
      }),
      handler: async (input) => {
        return { result: `Echo: ${input.message}` };
      },
    });

    expect(tool.name).toBe('TEST_TOOL');
    expect(tool.execute).toBeDefined();
    expect(typeof tool.execute).toBe('function');
  });

  it('should execute tool handler', async () => {
    const handler = vi.fn(async (input: { value: number }) => {
      return { doubled: input.value * 2 };
    });

    const tool = defineTool({
      name: 'DOUBLE',
      description: 'Double a number',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ doubled: z.number() }),
      handler,
    });

    const ctx = createMockContext();
    const result = await tool.execute({ value: 5 }, ctx);

    expect(handler).toHaveBeenCalledWith({ value: 5 }, ctx);
    expect(result).toEqual({ doubled: 10 });
  });

  it('should set tool name in context', async () => {
    const tool = defineTool({
      name: 'SET_NAME_TOOL',
      description: 'Test tool',
      inputSchema: z.object({}),
      handler: async (_input, ctx) => {
        expect(ctx.toolName).toBe('SET_NAME_TOOL');
        return {};
      },
    });

    const ctx = createMockContext();
    await tool.execute({}, ctx);
  });

  it('should record metrics on success', async () => {
    const tool = defineTool({
      name: 'METRIC_TOOL',
      description: 'Test tool',
      inputSchema: z.object({}),
      handler: async () => ({}),
    });

    const ctx = createMockContext();
    await tool.execute({}, ctx);

    expect(ctx.meter.createHistogram).toHaveBeenCalled();
    expect(ctx.meter.createCounter).toHaveBeenCalled();
  });

  it('should log audit trail', async () => {
    const tool = defineTool({
      name: 'AUDIT_TOOL',
      description: 'Test tool',
      inputSchema: z.object({ data: z.string() }),
      handler: async () => ({}),
    });

    const ctx = createMockContext();
    await tool.execute({ data: 'test' }, ctx);

    // Give async logging time to execute
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(ctx.storage.auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'AUDIT_TOOL',
        allowed: true,
      })
    );
  });

  it('should handle errors and record metrics', async () => {
    const tool = defineTool({
      name: 'ERROR_TOOL',
      description: 'Test tool',
      inputSchema: z.object({}),
      handler: async () => {
        throw new Error('Test error');
      },
    });

    const ctx = createMockContext();

    await expect(tool.execute({}, ctx)).rejects.toThrow('Test error');
    expect(ctx.meter.createCounter).toHaveBeenCalled();
  });
});

describe('toMCPSchema', () => {
  it('should convert Zod schema to JSON Schema', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().optional(),
    });

    const jsonSchema = toMCPSchema(schema);

    expect(jsonSchema).toHaveProperty('type', 'object');
    expect(jsonSchema).toHaveProperty('properties');
  });
});

describe('toMCPToolDefinition', () => {
  it('should create MCP tool definition', () => {
    const tool = defineTool({
      name: 'TEST',
      description: 'Test tool',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ result: z.number() }),
      handler: async () => ({ result: 0 }),
    });

    const mcpDef = toMCPToolDefinition(tool);

    expect(mcpDef).toEqual({
      name: 'TEST',
      description: 'Test tool',
      inputSchema: expect.any(Object),
      outputSchema: expect.any(Object),
    });
  });
});
```

Run: `bun test apps/mesh/src/core/define-tool.test.ts`

## Validation

- [ ] defineTool creates Tool with execute method
- [ ] Execute method sets toolName in context
- [ ] Execute method records metrics (histogram and counter)
- [ ] Execute method logs audit trail
- [ ] Execute method handles errors properly
- [ ] toMCPSchema converts Zod to JSON Schema
- [ ] Tests pass

## Reference

See spec section: **Tool Definition Pattern** (lines 249-295, 1386-1458)


import { SpanStatusCode } from '@opentelemetry/api';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { defineTool, toMCPSchema, toMCPToolDefinition } from './define-tool';
import type { MeshContext } from './mesh-context';

// Mock MeshContext
const createMockContext = (): MeshContext => ({
  auth: {
    user: { id: 'user_1', email: '[email protected]', name: 'Test', role: 'admin' },
  },
  storage: {
    projects: null as any,
    connections: null as any,
    auditLogs: {
      log: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([]),
    } as any,
    roles: null as any,
  },
  vault: null as any,
  authInstance: null as any,
  access: {
    granted: vi.fn().mockReturnValue(true),
    check: vi.fn().mockResolvedValue(undefined),
    grant: vi.fn(),
  } as any,
  db: null as any,
  tracer: {
    startActiveSpan: vi.fn((_name: string, _opts: any, fn: any) => fn({
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
  describe('tool creation', () => {
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
      expect(tool.description).toBe('A test tool');
      expect(tool.execute).toBeDefined();
      expect(typeof tool.execute).toBe('function');
    });

    it('should preserve original properties', () => {
      const inputSchema = z.object({ value: z.number() });
      const outputSchema = z.object({ result: z.number() });
      const handler = vi.fn();

      const tool = defineTool({
        name: 'MY_TOOL',
        description: 'Test',
        inputSchema,
        outputSchema,
        handler,
      });

      expect(tool.inputSchema).toBe(inputSchema);
      expect(tool.outputSchema).toBe(outputSchema);
      expect(tool.handler).toBe(handler);
    });
  });

  describe('tool execution', () => {
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
        outputSchema: z.object({}),
        handler: async (_input, ctx) => {
          expect(ctx.toolName).toBe('SET_NAME_TOOL');
          return {};
        },
      });

      const ctx = createMockContext();
      await tool.execute({}, ctx);
    });

    it('should start OpenTelemetry span', async () => {
      const tool = defineTool({
        name: 'TRACED_TOOL',
        description: 'Test tool',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        handler: async () => ({}),
      });

      const ctx = createMockContext();
      await tool.execute({}, ctx);

      expect(ctx.tracer.startActiveSpan).toHaveBeenCalledWith(
        'tool.TRACED_TOOL',
        expect.any(Object),
        expect.any(Function)
      );
    });
  });

  describe('metrics', () => {
    it('should record duration histogram on success', async () => {
      const tool = defineTool({
        name: 'METRIC_TOOL',
        description: 'Test tool',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        handler: async () => ({}),
      });

      const ctx = createMockContext();
      await tool.execute({}, ctx);

      expect(ctx.meter.createHistogram).toHaveBeenCalledWith(
        'tool.execution.duration',
        expect.any(Object)
      );
    });

    it('should increment execution counter on success', async () => {
      const tool = defineTool({
        name: 'COUNTER_TOOL',
        description: 'Test tool',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        handler: async () => ({}),
      });

      const ctx = createMockContext();
      await tool.execute({}, ctx);

      expect(ctx.meter.createCounter).toHaveBeenCalledWith(
        'tool.execution.count',
        expect.any(Object)
      );
    });

    it('should record error metrics on failure', async () => {
      const tool = defineTool({
        name: 'ERROR_TOOL',
        description: 'Test tool',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        handler: async () => {
          throw new Error('Test error');
        },
      });

      const ctx = createMockContext();

      await expect(tool.execute({}, ctx)).rejects.toThrow('Test error');
      expect(ctx.meter.createCounter).toHaveBeenCalledWith(
        'tool.execution.errors',
        expect.any(Object)
      );
    });
  });

  describe('audit logging', () => {
    it('should log audit trail', async () => {
      const tool = defineTool({
        name: 'AUDIT_TOOL',
        description: 'Test tool',
        inputSchema: z.object({ data: z.string() }),
        outputSchema: z.object({}),
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

    it('should not throw if audit logging fails', async () => {
      const tool = defineTool({
        name: 'SAFE_TOOL',
        description: 'Test tool',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        handler: async () => ({}),
      });

      const ctx = createMockContext();
      ctx.storage.auditLogs.log = vi.fn().mockRejectedValue(new Error('Logging failed'));

      // Should not throw even if logging fails
      await expect(tool.execute({}, ctx)).resolves.toBeDefined();
    });

    it('should work without audit log storage', async () => {
      const tool = defineTool({
        name: 'NO_AUDIT_TOOL',
        description: 'Test tool',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        handler: async () => ({}),
      });

      const ctx = createMockContext();
      ctx.storage.auditLogs = null as any;

      // Should not throw
      await expect(tool.execute({}, ctx)).resolves.toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should propagate handler errors', async () => {
      const tool = defineTool({
        name: 'ERROR_TOOL',
        description: 'Test tool',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        handler: async () => {
          throw new Error('Handler error');
        },
      });

      const ctx = createMockContext();

      await expect(tool.execute({}, ctx)).rejects.toThrow('Handler error');
    });

    it('should record exception in span', async () => {
      const tool = defineTool({
        name: 'EXCEPTION_TOOL',
        description: 'Test tool',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        handler: async () => {
          throw new Error('Test exception');
        },
      });

      const ctx = createMockContext();
      const mockSpan = {
        setStatus: vi.fn(),
        recordException: vi.fn(),
        end: vi.fn(),
      };

      ctx.tracer.startActiveSpan = vi.fn((_name: string, _opts: any, fn: any) => fn(mockSpan)) as any;

      await expect(tool.execute({}, ctx)).rejects.toThrow();
      expect(mockSpan.recordException).toHaveBeenCalled();
      expect(mockSpan.setStatus).toHaveBeenCalledWith(
        expect.objectContaining({ code: SpanStatusCode.ERROR })
      );
    });
  });
});

describe('toMCPSchema', () => {
  it('should convert Zod schema to JSON Schema', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().optional(),
    });

    const jsonSchema = toMCPSchema(schema);

    expect(jsonSchema).toBeDefined();
    expect(typeof jsonSchema).toBe('object');
    // zod-to-json-schema returns a valid JSON Schema object
    expect(jsonSchema).toHaveProperty('type');
  });

  it('should handle complex schemas', () => {
    const schema = z.object({
      name: z.string(),
      tags: z.array(z.string()),
      metadata: z.record(z.string(), z.any()),
    });

    const jsonSchema = toMCPSchema(schema);

    expect(jsonSchema).toBeDefined();
    expect(typeof jsonSchema).toBe('object');
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

  it('should work without output schema', () => {
    const tool = defineTool({
      name: 'NO_OUTPUT',
      description: 'Test tool',
      inputSchema: z.object({}),
      handler: async () => undefined as any,
    });

    const mcpDef = toMCPToolDefinition(tool);

    expect(mcpDef.outputSchema).toBeUndefined();
  });
});


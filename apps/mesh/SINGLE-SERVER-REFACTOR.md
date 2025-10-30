# MCP Single Server Refactor

## Overview

Refactored the MCP server implementation from a two-server approach to a single-server approach to resolve transport layer issues and improve code maintainability.

## Problem

The previous implementation used two MCP servers:
- **Server A**: Registered all tools and handled execution
- **Server B**: Wrapped Server A with middleware, delegating via transport

This caused issues:
- Transport layer isn't designed for server-to-server communication within the same process
- Extra overhead from creating transports for each request
- Harder to debug and understand
- Potential for connection/lifecycle issues

## Solution

Single MCP server with middleware wrapping tool handlers directly:

1. **Tools are registered once** with the MCP server
2. **Middleware wraps handlers** at registration time (not via transport)
3. **list_tools is manually implemented** with proper Zod → JSON Schema conversion
4. **No transport delegation** needed between servers

## Key Changes

### 1. Updated `apps/mesh/src/api/utils/mcp.ts`

#### Before (Two-Server Approach)
```typescript
// Created two servers
const onlyToolServer = new McpServer(...);
const withMiddlewareServer = new McpServer(...);

// Registered tools on first server
onlyToolServer.registerTool(...);

// Second server delegated via transport
withMiddlewareServer.server.setRequestHandler(
  CallToolRequestSchema,
  async (request) => {
    const transport = new HttpServerTransport();
    await onlyToolServer.connect(transport);
    // Delegate to first server...
  }
);
```

#### After (Single-Server Approach)
```typescript
// Single server
const server = new McpServer(...);

// Wrap handler with middleware directly
const wrappedHandler = callToolPipeline
  ? async (args: any) => {
      const request = { method: 'tools/call', params: { name, arguments: args } };
      return await callToolPipeline(request, () => baseHandler(args));
    }
  : baseHandler;

// Register wrapped handler
server.registerTool(name, schema, wrappedHandler);

// Manually implement list_tools with Zod → JSON Schema
server.server.setRequestHandler(
  ListToolsRequestSchema,
  async () => ({
    tools: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: zodToJsonSchema(tool.inputSchema),
    })),
  })
);
```

### 2. Updated `apps/mesh/src/api/routes/proxy.ts`

Simplified proxy implementation:
- Single MCP server per connection
- Direct middleware composition without nested servers
- Manual list_tools implementation that fetches from downstream

#### Key Changes
```typescript
// Single server creation
const server = new McpServer({ name: 'mcp-mesh', version: '1.0.0' });

// Manual list_tools - fetch from downstream
server.server.setRequestHandler(
  ListToolsRequestSchema,
  async () => {
    const client = await createClient();
    return await client.listTools();
  }
);

// Call tool with middleware
server.server.setRequestHandler(
  CallToolRequestSchema,
  (request) => callToolPipeline(request, async () => {
    const client = await createClient();
    return await client.callTool(request.params);
  })
);
```

## Important Fix: JSON Schema Conversion

### The `keyValidator._parse is not a function` Error

**Problem**: Previously, we extracted the raw `.shape` from Zod schemas and passed them to `registerTool`:

```typescript
// ❌ WRONG - causes "keyValidator._parse is not a function"
const inputSchema = tool.inputSchema.shape; // { name: z.string(), ... }
server.registerTool(name, { inputSchema }, handler);
```

When you extract `.shape`, you get a plain JavaScript object like `{ name: z.string() }`, which is NOT a valid Zod schema - it's just an object with Zod schemas as values. This causes the error because the MCP SDK tries to call `._parse()` on something that isn't a Zod schema.

**Solution**: Convert Zod schemas to JSON Schema using `zodToJsonSchema`:

```typescript
// ✅ CORRECT - converts to proper JSON Schema
const jsonSchema = zodToJsonSchema(tool.inputSchema, {
  target: 'openApi3',
  $refStrategy: 'none',
});

server.registerTool(name, {
  inputSchema: {
    type: 'object',
    properties: jsonSchema.properties || {},
    required: jsonSchema.required || [],
  }
}, handler);
```

This ensures both `registerTool` and `list_tools` use consistent JSON Schema representation, avoiding the parse error.

## Benefits

### 1. **Cleaner Architecture**
- One server per MCP endpoint
- Middleware wraps handlers directly (no transport overhead)
- Easier to understand and debug

### 2. **Better Performance**
- No transport creation/teardown per request
- No serialization between servers
- Direct function calls

### 3. **Proper JSON Schema Support**
- `zod-to-json-schema` for proper conversion
- Returns correct MCP `ListToolsResult` format:
  ```typescript
  {
    tools: [{
      name: string,
      description?: string,
      inputSchema: {
        type: "object",
        properties: {...},
        required: [...]
      }
    }]
  }
  ```

### 4. **Middleware Execution Order**
Middleware wraps tool execution correctly:
```
middleware(request, next) {
  // 1. Pre-processing
  console.log('Before:', request.params.name);
  
  // 2. Tool executes
  const result = await next();
  
  // 3. Post-processing
  console.log('After:', result);
  return result;
}
```

## Testing

All tests pass:
```bash
bun test src/api/integration.test.ts
# ✓ should list all management tools via MCP protocol
```

Integration test verifies:
- Tools are listed correctly via MCP protocol
- JSON Schema conversion works
- All 10 management tools are exposed
- Each tool has name, description, and inputSchema

## Migration Notes

### For Management Tools (`/mcp`)
- No changes needed to tool definitions
- Middleware still works the same way
- `list_tools` now returns proper JSON Schema

### For Proxy Routes (`/mcp/:connectionId`)
- Simplified server creation
- Same middleware behavior
- `list_tools` fetches from downstream client

### For Custom Middleware
Middleware signature unchanged:
```typescript
export type CallToolMiddleware = (
  request: CallToolRequest,
  next: () => Promise<CallToolResult>
) => Promise<CallToolResult>;
```

Execution flow:
1. Request comes in
2. Middleware runs (can inspect request)
3. Middleware calls `next()` to execute tool
4. Tool executes and returns result
5. Middleware resumes (can inspect/modify result)
6. Result returned to client

## Files Changed

- `apps/mesh/src/api/utils/mcp.ts` - Single server implementation
- `apps/mesh/src/api/routes/proxy.ts` - Simplified proxy
- `apps/mesh/src/api/routes/management.ts` - No changes (works as-is)

## Removed

- Two-server delegation pattern
- Internal transport creation for middleware
- `ListToolsMiddleware` type (not needed)
- Server-to-server request delegation

## Added

- `zod-to-json-schema` for proper schema conversion
- Manual `list_tools` implementation
- Direct middleware wrapping at registration time
- Better documentation and examples


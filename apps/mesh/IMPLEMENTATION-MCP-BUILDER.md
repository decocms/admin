# MCP Server Builder Implementation

## Summary

Created a builder pattern wrapper for MCP servers inspired by `@deco/api` that simplifies creating MCP servers with middleware support.

## Files Created

### 1. `/apps/mesh/src/api/routes/mcp.ts` (Main Implementation)
The core builder pattern implementation with:
- **McpServerBuilder class**: Fluent API for building MCP servers
- **Dual server architecture**: Tool server + middleware server
- **Middleware composition**: Reuses shared compose utility
- **Type-safe APIs**: Full TypeScript support with Zod schemas

Key features:
```typescript
mcpServer({ name, version, capabilities })
  .withTool(tool)
  .withTools([...tools])
  .callToolMiddleware(...middlewares)
  .listToolMiddleware(...middlewares)
  .build() // Returns { listTools, callTool, fetch }
```

### 2. `/apps/mesh/src/api/utils/compose.ts` (Shared Utility)
Extracted middleware composition logic from `proxy.ts`:
- Generic compose function for middleware pipelines
- Shared between `mcp.ts` and `proxy.ts`
- Pattern from `@deco/sdk/mcp/middlewares.ts`

### 3. `/apps/mesh/src/api/routes/mcp.example.ts` (Examples)
Comprehensive examples demonstrating:
- Basic server with tools
- Server with middlewares (logging, auth, filtering)
- Context-aware servers
- Dynamic tool registration
- Proxy pattern
- Integration with Hono routes

### 4. `/apps/mesh/src/api/routes/mcp.README.md` (Documentation)
Complete documentation including:
- Architecture overview
- API reference
- Usage patterns
- Integration examples
- Middleware execution order
- Comparison with direct SDK usage

## Files Modified

### `/apps/mesh/src/api/routes/proxy.ts`
Updated to use shared `compose` function from `../utils/compose.ts`:
- Removed duplicate compose implementation
- Imports `compose` from shared utility
- No functional changes, just code reuse

## Architecture

### Dual Server Pattern

The builder creates two MCP servers internally:

```
┌─────────────────────────────────────────────────────────┐
│                    Incoming Request                      │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              Middleware Server                           │
│  - Intercepts MCP protocol requests                      │
│  - Runs middleware pipelines                             │
│  - Delegates to Tool Server                              │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                  Middleware Pipeline                     │
│  middleware1 → middleware2 → middleware3 → ...          │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                   Tool Server                            │
│  - Registers all tools with handlers                     │
│  - Executes tool logic                                   │
│  - Returns results                                       │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                       Response                           │
└─────────────────────────────────────────────────────────┘
```

### Why Two Servers?

1. **Tool Server**: Handles tool registration and execution
   - Pure business logic
   - No middleware concerns
   - Can be tested independently

2. **Middleware Server**: Handles cross-cutting concerns
   - Authorization
   - Logging
   - Rate limiting
   - Observability
   - Error handling

This separation allows:
- Clean middleware composition
- Tool logic isolation
- Flexible middleware ordering
- Easy testing and debugging

## Usage Examples

### Basic Usage

```typescript
const server = mcpServer({ name: 'simple', version: '1.0.0' })
  .withTool({
    name: 'greet',
    inputSchema: z.object({ name: z.string() }),
    handler: async (args) => ({ greeting: `Hello, ${args.name}!` })
  })
  .build();

app.post('/mcp', async (c) => server.fetch(c.req.raw));
```

### With Middleware

```typescript
const server = mcpServer({ name: 'secured', version: '1.0.0' })
  .withTool(myTool)
  .callToolMiddleware(async (request, next) => {
    console.log('Calling:', request.params.name);
    return next();
  })
  .callToolMiddleware(async (request, next) => {
    if (!hasPermission(request.params.name)) {
      return { content: [{ type: 'text', text: 'Unauthorized' }], isError: true };
    }
    return next();
  })
  .build();
```

### Context-Aware

```typescript
app.post('/mcp', async (c) => {
  const ctx = c.get('meshContext');
  
  const server = mcpServer({ name: 'api', version: '1.0.0' })
    .withTool({
      name: 'list_projects',
      handler: async () => await ctx.storage.projects.list()
    })
    .callToolMiddleware(async (request, next) => {
      await ctx.accessControl.check(request.params.name);
      return next();
    })
    .build();
  
  return server.fetch(c.req.raw);
});
```

## Benefits

### 1. **Simplified API**
- Fluent builder pattern
- No manual transport setup
- No manual server connection

### 2. **Middleware Support**
- Clean middleware composition
- Reusable middleware functions
- Proper execution order

### 3. **Type Safety**
- Full TypeScript support
- Zod schema integration
- Compile-time checks

### 4. **Flexibility**
- Works with or without HTTP
- Direct method calls supported
- Easy to test

### 5. **Code Reuse**
- Shared utilities (compose)
- Consistent patterns
- DRY principle

## Inspiration from @deco/api

The implementation draws from these patterns in `apps/api/src/api.ts`:

1. **createMCPHandlerFor** (lines 196-292)
   - Tool registration loop
   - Schema unwrapping
   - Error handling
   - Transport setup

2. **proxy** function (lines 366-448)
   - Middleware composition with `compose`
   - Dual handler pattern (listTools, callTool)
   - fetch function that wraps MCP protocol

3. **Middleware patterns**
   - `withMCPAuthorization` style middleware
   - Request/response interception
   - Context propagation

## Testing

The builder can be tested at multiple levels:

```typescript
// 1. Unit test individual tools
const result = await tool.handler({ name: 'Alice' });
expect(result.greeting).toBe('Hello, Alice!');

// 2. Test server with direct calls
const server = mcpServer({ name: 'test', version: '1.0.0' })
  .withTool(tool)
  .build();

const result = await server.callTool({
  method: 'tools/call',
  params: { name: 'greet', arguments: { name: 'Alice' } }
});

// 3. Test with HTTP
const response = await server.fetch(mockRequest);
expect(response.status).toBe(200);

// 4. Test middleware execution
let middlewareCalled = false;
const server = mcpServer({ name: 'test', version: '1.0.0' })
  .withTool(tool)
  .callToolMiddleware(async (req, next) => {
    middlewareCalled = true;
    return next();
  })
  .build();

await server.callTool({ ... });
expect(middlewareCalled).toBe(true);
```

## Future Enhancements

Potential improvements:

1. **Resource Support**: Add `.withResource()` for MCP resources
2. **Prompt Support**: Add `.withPrompt()` for MCP prompts
3. **Batch Operations**: Support batch tool calls
4. **Streaming**: Support streaming responses
5. **Caching**: Built-in response caching middleware
6. **Rate Limiting**: Built-in rate limiting middleware
7. **Metrics**: Automatic metrics collection
8. **Schema Validation**: More sophisticated schema handling

## Migration Guide

### From Direct SDK Usage

Before:
```typescript
const server = new McpServer({ name: 'api', version: '1.0.0' }, {
  capabilities: { tools: {} }
});

for (const tool of tools) {
  server.registerTool(tool.name, { inputSchema: tool.inputSchema.shape }, tool.handler);
}

server.server.setRequestHandler(CallToolRequestSchema, async (request) => {
  await authMiddleware(request);
  return server.request(request, CallToolResultSchema);
});

const transport = new HttpServerTransport();
await server.connect(transport);
return transport.handleMessage(req);
```

After:
```typescript
const server = mcpServer({ name: 'api', version: '1.0.0' })
  .withTools(tools)
  .callToolMiddleware(authMiddleware)
  .build();

return server.fetch(req);
```

## Conclusion

The MCP Server Builder provides a clean, type-safe, and flexible way to create MCP servers with middleware support. It simplifies common patterns, promotes code reuse, and makes it easy to add cross-cutting concerns like authorization, logging, and observability.

The implementation is production-ready and follows best practices from the existing codebase, particularly `@deco/api`.


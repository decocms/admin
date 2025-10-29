# Implementation Quick Start Guide

This guide helps you start implementing the MCP Mesh following the implementation plan.

## Getting Started

### 1. Install Dependencies

```bash
cd apps/mesh
bun install
```

Dependencies are already specified in `package.json` with exact versions.

### 2. Start with Foundation (Phase 1)

Implement in order:

#### Day 1: Database Layer

**Morning:**
- [ ] `01-database-types.md` - Define all TypeScript interfaces
  - Location: `src/storage/types.ts`
  - Expected time: 2-3 hours
  - Run tests: `bun test src/storage/types.test.ts`

**Afternoon:**
- [ ] `02-database-factory.md` - Create database connection
  - Location: `src/database/index.ts`
  - Expected time: 1-2 hours
  - Test: `bun test src/database/index.test.ts`

**Evening:**
- [ ] `03-storage-connections.md` - Connection storage
  - Location: `src/storage/connection.ts`
  - Expected time: 2-3 hours
  - Test: `bun test src/storage/connection.test.ts`

#### Day 2: More Storage + Core Abstractions

- [ ] `04-storage-projects.md` - Project storage
- [ ] `05-mesh-context.md` - MeshContext interface
- [ ] `06-define-tool.md` - Tool definition pattern

**Checkpoint:** After Day 2, you should have:
- ✅ Complete database schema
- ✅ Working storage layer
- ✅ Core abstractions defined
- ✅ All tests passing

### 3. Core Abstractions (Phase 2)

#### Day 3: Access Control & Context

- [ ] `07-access-control.md` - Authorization system
- [ ] `08-context-factory.md` - Context creation from HTTP requests

**Checkpoint:** You can now create MeshContext from requests!

### 4. Authentication (Phase 3)

#### Day 4: Auth Setup

- [ ] `09-better-auth-setup.md` - Better Auth integration
- [ ] `10-credential-vault.md` - Encryption for credentials

**Checkpoint:** Authentication is ready!

### 5. API Layer (Phase 4)

#### Day 5: Hono Setup

- [ ] `11-hono-app.md` - Main Hono application
- Run the server: `bun run dev`
- Test health check: `curl http://localhost:3000/health`

**Checkpoint:** Server is running! 🎉

### 6. First Tools (Phase 5)

#### Days 6-8: Core Tools

- [ ] `14-tools-project.md` - Project management
- [ ] `15-tools-connection.md` - Connection management
- [ ] `19-proxy-routes.md` - MCP proxy (makes it all work!)

**Checkpoint:** You can create projects, add connections, and proxy MCP requests!

### 7. Access Control (Phase 5 continued)

#### Days 9-10: Policies & Tokens

- [ ] `16-tools-policy.md` - Policy management
- [ ] `17-tools-role.md` - Role management  
- [ ] `18-tools-token.md` - API key management

**Checkpoint:** Full access control system working!

### 8. Advanced Features (Phase 6)

#### Days 11-13: Polish

- [ ] `20-bindings.md` - MCP bindings system
- [ ] `21-observability.md` - OpenTelemetry setup
- [ ] `22-oauth-downstream.md` - Downstream OAuth client

### 9. Teams & Audit (Phase 7)

#### Days 14-15: Finish

- [ ] `23-storage-audit.md` - Audit logs
- [ ] `24-storage-teams.md` - Team storage
- [ ] `25-tools-team.md` - Team tools
- [ ] `26-tools-audit.md` - Audit query tools

**Final Checkpoint:** Complete MCP Mesh! 🚀

---

## Testing Strategy

### Run Tests as You Go

After each implementation file:
```bash
# Test specific file
bun test src/storage/types.test.ts

# Test entire directory
bun test src/storage

# Test everything
bun test

# Watch mode
bun test --watch
```

### Test Coverage

Check coverage after major milestones:
```bash
bun test --coverage
```

Aim for:
- **Core abstractions:** 90%+ coverage
- **Storage layer:** 80%+ coverage
- **Tools:** 70%+ coverage

---

## Development Workflow

### 1. Read Implementation File

Each file contains:
- Overview (what you're building)
- Dependencies (what must be done first)
- Context (essential background)
- Implementation steps (detailed instructions)
- Testing (how to verify)
- Validation checklist

### 2. Write Code

Follow the file structure exactly:
- Use specified file locations
- Match interface signatures
- Follow Kysely patterns for storage
- Use `defineTool` for tools
- Include error handling

### 3. Write Tests

Every implementation file includes test examples:
- Copy test structure
- Add edge cases
- Test error conditions
- Mock dependencies properly

### 4. Run Tests

```bash
bun test <file>
```

Don't move on until tests pass!

### 5. Check Validation

Each file has a validation checklist:
- [ ] Feature works
- [ ] Tests pass
- [ ] No linter errors
- [ ] Types compile

---

## Common Patterns

### Storage Classes

```typescript
export class MyStorage implements MyStoragePort {
  constructor(private db: Kysely<Database>) {}
  
  async create(data: CreateData): Promise<Entity> {
    return await this.db
      .insertInto('table')
      .values({ ...data, id: `prefix_${nanoid()}` })
      .returningAll()
      .executeTakeFirstOrThrow();
  }
  
  async findById(id: string): Promise<Entity | null> {
    return await this.db
      .selectFrom('table')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst() ?? null;
  }
}
```

### Tool Definitions

```typescript
export const MY_TOOL = defineTool({
  name: 'MY_TOOL',
  description: 'Does something useful',
  inputSchema: z.object({
    param: z.string(),
  }),
  outputSchema: z.object({
    result: z.string(),
  }),
  handler: async (input, ctx) => {
    // Check authorization
    await ctx.access.check();
    
    // Business logic
    const result = await ctx.storage.something.doThing(input.param);
    
    return { result };
  },
});
```

### Hono Routes

```typescript
app.post('/my-route', async (c) => {
  const ctx = c.get('meshContext');
  const body = await c.req.json();
  
  const result = await MY_TOOL.execute(body, ctx);
  
  return c.json(result);
});
```

---

## Troubleshooting

### Database Issues

**Error:** `Table does not exist`
**Fix:** Need to implement migrations (not in current plan)
**Workaround:** Use in-memory SQLite for testing

### Type Errors

**Error:** `Type 'X' is not assignable to type 'Y'`
**Fix:** Check that you're using the exact interfaces from `storage/types.ts`

### Test Failures

**Error:** `Cannot find module 'X'`
**Fix:** Ensure dependencies are installed: `bun install`

**Error:** `Connection refused`
**Fix:** Don't need real database for unit tests - use mocks

### Better Auth Issues

**Error:** `auth.api.X is undefined`
**Fix:** Ensure plugin is loaded in `auth/index.ts`

---

## Getting Help

### Reference Materials

1. **Spec Document:** `apps/mesh/spec/001.md`
   - Complete architecture details
   - All interfaces and patterns
   - Security considerations

2. **Implementation Files:** `apps/mesh/implementation/*.md`
   - Step-by-step instructions
   - Code examples
   - Test patterns

3. **Package Docs:**
   - [Kysely](https://kysely.dev/docs/getting-started)
   - [Better Auth](https://www.better-auth.com/docs)
   - [Hono](https://hono.dev/)
   - [Zod](https://zod.dev/)

### Debugging Tips

1. **Enable verbose logging:**
   ```typescript
   console.log('Debug:', { ctx, input });
   ```

2. **Use Bun debugger:**
   ```bash
   bun --inspect src/index.ts
   ```

3. **Check request headers:**
   ```typescript
   console.log(c.req.header('Authorization'));
   ```

4. **Verify database state:**
   ```typescript
   const rows = await db.selectFrom('table').selectAll().execute();
   console.log(rows);
   ```

---

## Success Metrics

After completing all tasks, you should be able to:

✅ Start the server
✅ Create a project via API
✅ Add an MCP connection
✅ Create an API key
✅ Proxy MCP requests through the Mesh
✅ View audit logs
✅ Manage teams and permissions

**Test the complete flow:**

```bash
# 1. Start server
bun run dev

# 2. Create project
curl -X POST http://localhost:3000/mcp/tools/PROJECT_CREATE \
  -H "Authorization: Bearer <admin-key>" \
  -d '{"name":"Test Project","slug":"test"}'

# 3. Add connection
curl -X POST http://localhost:3000/test/mcp/tools/CONNECTION_CREATE \
  -H "Authorization: Bearer <project-key>" \
  -d '{"name":"Gmail","connection":{"type":"HTTP","url":"https://mcp.gmail.com"}}'

# 4. Proxy request
curl -X POST http://localhost:3000/test/mcp/conn_abc123 \
  -H "Authorization: Bearer <project-key>" \
  -d '{"tool":"SEND_EMAIL","arguments":{...}}'
```

---

## Next Steps

After implementing core features:

1. **Add migrations** - Proper database schema management
2. **Add UI** - Web-based admin interface
3. **Add CLI** - Command-line management tool
4. **Add docs** - User documentation
5. **Add examples** - Sample integrations
6. **Deploy** - Production deployment guide

---

Good luck! 🚀

Remember: Follow the numbered order, write tests, and validate each step before moving on.


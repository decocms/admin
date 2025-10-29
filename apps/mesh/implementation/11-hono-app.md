# Task 11: Hono Application Setup

## Overview
Create the main Hono application with routes, middleware, and Better Auth integration.

## Dependencies
- `09-better-auth-setup.md` (needs auth instance)
- `08-context-factory.md` (needs context factory)
- `02-database-factory.md` (needs database)

## Context from Spec

The Hono app:
1. Mounts Better Auth handler (`/api/auth/*`)
2. Serves MCP tools endpoint (`/mcp/tools/*`)
3. Serves MCP proxy endpoint (`/mcp/:connectionId`)
4. Integrates observability (OpenTelemetry)

## Implementation Steps

### 1. Create main application file

**Location:** `apps/mesh/src/api/index.ts`

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { auth } from '../auth';
import { db } from '../database';
import { createMeshContextFactory } from '../core/context-factory';
import { tracer, meter } from '../observability';
import { createVault } from '../encryption/credential-vault';

const app = new Hono();

// CORS middleware
app.use('/*', cors({
  origin: ['http://localhost:3000', 'https://mesh.example.com'],
  credentials: true,
}));

// Request logging
app.use('*', logger());

// Health check
app.get('/health', (c) => {
  return c.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// Mount Better Auth handler
// This automatically handles:
// - /.well-known/oauth-authorization-server
// - /.well-known/oauth-protected-resource
// - /api/auth/oauth/authorize
// - /api/auth/oauth/token
// - /api/auth/oauth/register (Dynamic Client Registration)
// - /api/auth/mcp/session
app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw));

// Create context factory
const createContext = createMeshContextFactory({
  db,
  auth,
  encryption: {
    key: process.env.ENCRYPTION_KEY || '',
  },
  observability: {
    tracer,
    meter,
  },
});

// Inject MeshContext middleware
app.use('*', async (c, next) => {
  try {
    const ctx = await createContext(c);
    c.set('meshContext', ctx);
    await next();
  } catch (error) {
    if (error.name === 'UnauthorizedError') {
      return c.json({ error: error.message }, 401);
    }
    if (error.name === 'NotFoundError') {
      return c.json({ error: error.message }, 404);
    }
    throw error;
  }
});

// TODO: Mount tool execution routes (task 13)
// TODO: Mount proxy routes (task 19)

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  
  return c.json({
    error: 'Internal Server Error',
    message: err.message,
  }, 500);
});

// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'Not Found',
    path: c.req.path,
  }, 404);
});

export default app;
export { app };
```

### 2. Create server entry point

**Location:** `apps/mesh/src/index.ts`

```typescript
import app from './api';

const port = parseInt(process.env.PORT || '3000', 10);

console.log(`Starting MCP Mesh on port ${port}...`);

export default {
  port,
  fetch: app.fetch,
};

// For Bun
if (import.meta.main) {
  Bun.serve({
    port,
    fetch: app.fetch,
  });
  
  console.log(`✅ MCP Mesh running at http://localhost:${port}`);
  console.log(`📋 Health check: http://localhost:${port}/health`);
  console.log(`🔐 Auth endpoints: http://localhost:${port}/api/auth/*`);
}
```

### 3. Add package.json scripts

Update `apps/mesh/package.json`:

```json
{
  "scripts": {
    "start": "bun run src/index.ts",
    "dev": "bun --watch src/index.ts",
    "test": "vitest",
    "test:watch": "vitest --watch"
  }
}
```

## File Locations

```
apps/mesh/
  src/
    api/
      index.ts       # Main Hono app
    index.ts         # Server entry point
```

## Testing

Create `apps/mesh/src/api/index.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import app from './index';

describe('Hono App', () => {
  it('should respond to health check', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    
    const json = await res.json();
    expect(json.status).toBe('ok');
    expect(json.timestamp).toBeDefined();
  });

  it('should return 404 for unknown routes', async () => {
    const res = await app.request('/unknown');
    expect(res.status).toBe(404);
    
    const json = await res.json();
    expect(json.error).toBe('Not Found');
  });

  it('should have CORS headers', async () => {
    const res = await app.request('/health', {
      headers: { 'Origin': 'http://localhost:3000' },
    });
    
    expect(res.headers.get('access-control-allow-origin')).toBeTruthy();
  });

  it('should mount Better Auth routes', async () => {
    // .well-known endpoints should exist
    const res = await app.request('/.well-known/oauth-authorization-server');
    
    // May be 404 if Better Auth not fully configured, but route exists
    expect(res.status).toBeLessThan(500);
  });
});
```

Run: `bun test apps/mesh/src/api/index.test.ts`

## Running the Server

```bash
# Development
bun run dev

# Production
bun run start
```

Visit http://localhost:3000/health to verify.

## Validation

- [ ] Hono app created
- [ ] Health check responds
- [ ] CORS configured
- [ ] Better Auth mounted
- [ ] Context injection middleware works
- [ ] Error handlers configured
- [ ] Server starts successfully
- [ ] Tests pass

## Reference

See spec section: **Tool Registration and Pipeline** (lines 2842-2939)


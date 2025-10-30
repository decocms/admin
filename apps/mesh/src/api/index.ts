/**
 * MCP Mesh API Server
 * 
 * Main Hono application with:
 * - Better Auth integration
 * - Context injection middleware
 * - Error handling
 * - CORS support
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { auth } from '../auth';
import { createMeshContextFactory } from '../core/context-factory';
import type { MeshContext } from '../core/mesh-context';
import { getDb } from '../database';
import { meter, tracer } from '../observability';
import managementRoutes from './routes/management';
import proxyRoutes from './routes/proxy';
// Define Hono variables type
type Variables = {
  meshContext: MeshContext;
};

const app = new Hono<{ Variables: Variables }>();

// ============================================================================
// Middleware
// ============================================================================

// CORS middleware
app.use('/*', cors({
  origin: (origin) => {
    // Allow localhost and configured origins
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return origin;
    }
    // TODO: Configure allowed origins from environment
    return origin;
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Request logging
app.use('*', logger());

// ============================================================================
// Health Check
// ============================================================================

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// ============================================================================
// Better Auth Routes
// ============================================================================

// Mount Better Auth handler
// This automatically handles:
// - /.well-known/oauth-authorization-server
// - /.well-known/oauth-protected-resource
// - /api/auth/oauth/authorize
// - /api/auth/oauth/token
// - /api/auth/oauth/register (Dynamic Client Registration)
// - /api/auth/mcp/session

app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw));

// ============================================================================
// MeshContext Injection Middleware
// ============================================================================

// Create context factory
const createContext = createMeshContextFactory({
  db: getDb(),
  auth,
  encryption: {
    key: process.env.ENCRYPTION_KEY || '',
  },
  observability: {
    tracer,
    meter,
  },
});

// Inject MeshContext into requests
app.use('*', async (c, next) => {
  try {
    const ctx = await createContext(c);
    c.set('meshContext', ctx);
    return await next();
  } catch (error) {
    const err = error as Error;

    if (err.name === 'UnauthorizedError') {
      return c.json({ error: err.message }, 401);
    }
    if (err.name === 'NotFoundError') {
      return c.json({ error: err.message }, 404);
    }

    throw error;
  }
});

// ============================================================================
// Routes
// ============================================================================

app.use("/mcp", async (c, next) => {
  const session = await auth.api.getMcpSession({
    headers: c.req.raw.headers
  })
  if (!session) {
    const origin = new URL(c.req.url).origin;
    //this is important and you must return 401
    return c.res = new Response(null, {
      status: 401,
      headers: {
        "WWW-Authenticate": `Bearer realm="mcp",resource_metadata="${origin}/api/auth/.well-known/oauth-protected-resource"`
      }
    })
  }
  return await next();
})
// Mount management tools MCP server at /mcp (no connectionId)
// This exposes PROJECT_*, CONNECTION_* tools via MCP protocol
app.route('/mcp', managementRoutes);

// Mount MCP proxy routes at /mcp/:connectionId
// Connection IDs are globally unique UUIDs
app.route('/mcp', proxyRoutes);

// ============================================================================
// Error Handlers
// ============================================================================

// Global error handler
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


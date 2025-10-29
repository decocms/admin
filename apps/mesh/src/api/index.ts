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

// Mount proxy routes
// Organization-scoped: /mcp/:connectionId
// Project-scoped: /:project/mcp/:connectionId
app.route('/mcp', proxyRoutes);
app.route('/:project/mcp', proxyRoutes);

// TODO: Mount tool execution routes (Task 13)
// app.route('/mcp/tools', toolRoutes);
// app.route('/:project/mcp/tools', toolRoutes);

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


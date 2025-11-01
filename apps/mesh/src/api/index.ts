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
import { serveStatic } from 'hono/bun';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { auth } from '../auth';
import { createMeshContextFactory } from '../core/context-factory';
import type { MeshContext } from '../core/mesh-context';
import { getDb } from '../database';
import { meter, tracer } from '../observability';
import customAuthRoutes from './routes/auth';
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
  allowHeaders: ['Content-Type', 'Authorization', 'mcp-protocol-version'],
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
// Tool Metadata API
// ============================================================================

import { getToolsByCategory, MANAGEMENT_TOOLS } from '../tools/registry';

// Get all management tools (for OAuth consent UI)
app.get('/api/tools/management', (c) => {
  return c.json({
    tools: MANAGEMENT_TOOLS,
    grouped: getToolsByCategory(),
  });
});

// ============================================================================
// Static Files - Authentication Pages
// ============================================================================

// Serve sign-in page at /sign-in
app.get('/sign-in', serveStatic({ path: './public/sign-in.html' }));


// ============================================================================
// Better Auth Routes
// ============================================================================

// Mount custom auth routes first (they take precedence over Better Auth catch-all)
// These provide OAuth-friendly authentication endpoints that return callback URLs
// in response body instead of using 302 redirects
app.route('/api/auth/custom', customAuthRoutes);

// Mount Better Auth handler for ALL /api/auth/* routes
// This handles:
// - /api/auth/sign-in/email, /api/auth/sign-up/email
// - /api/auth/session
// - /api/auth/authorize (OAuth authorization endpoint)
// - /api/auth/token (OAuth token endpoint)  
// - /api/auth/register (Dynamic Client Registration)
// - All other Better Auth endpoints
app.all('/api/auth/*', async (c) => {
  return await auth.handler(c.req.raw);
});

// Mount OAuth discovery metadata endpoints
import { oAuthDiscoveryMetadata, oAuthProtectedResourceMetadata } from "better-auth/plugins";
const handleOAuthProtectedResourceMetadata = oAuthProtectedResourceMetadata(auth);
const handleOAuthDiscoveryMetadata = oAuthDiscoveryMetadata(auth);

app.get('/.well-known/oauth-protected-resource/*', (c) => handleOAuthProtectedResourceMetadata(c.req.raw));
app.get('/.well-known/oauth-authorization-server/*', (c) => handleOAuthDiscoveryMetadata(c.req.raw));

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
// Skip auth routes, static files, and health check - they don't need MeshContext
app.use('*', async (c, next) => {
  const path = c.req.path;

  // Skip MeshContext for auth endpoints, static pages, and health check
  if (
    path.startsWith('/api/auth/') ||
    path === '/sign-in' ||
    path === '/health' ||
    path.startsWith('/.well-known/')
  ) {
    return await next();
  }

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

app.use('/mcp', async (c, next) => {
  const meshContext = c.var.meshContext;
  // Require either user or API key authentication
  if (!meshContext.auth.user?.id && !meshContext.auth.apiKey?.id) {
    const origin = new URL(c.req.url).origin;
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
// This exposes CONNECTION_* tools via MCP protocol
// Organizations managed via Better Auth organization plugin
// Authentication is handled by context-factory middleware above
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

// 404 handler with helpful message for OAuth endpoints
app.notFound((c) => {
  const path = c.req.path;

  return c.json({
    error: 'Not Found',
    path,
  }, 404);
});

export default app;
export { app };


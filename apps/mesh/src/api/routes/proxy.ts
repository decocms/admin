/**
 * MCP Proxy Routes
 * 
 * Proxies MCP requests to downstream connections with:
 * - Authorization checks
 * - Credential replacement
 * - Audit logging
 * - Trace propagation
 */

import { Hono } from 'hono';
import { ContentfulStatusCode } from 'hono/utils/http-status';
import type { MeshContext } from '../../core/mesh-context';

// Define Hono variables type
type Variables = {
  meshContext: MeshContext;
};

const app = new Hono<{ Variables: Variables }>();

/**
 * Proxy MCP request to a connection
 * 
 * Route: POST /mcp/:connectionId (organization-scoped)
 *        POST /:project/mcp/:connectionId (project-scoped)
 */
app.post('/:connectionId', async (c) => {
  const connectionId = c.req.param('connectionId');
  const ctx = c.get('meshContext');

  // Check authorization for this specific connection
  await ctx.access.check(connectionId);

  // Get connection details
  const connection = await ctx.storage.connections.findById(connectionId);

  if (!connection) {
    return c.json({ error: 'Connection not found' }, 404);
  }

  // Verify connection is active
  if (connection.status !== 'active') {
    return c.json({
      error: 'Connection inactive',
      status: connection.status,
    }, 503);
  }

  try {
    // Get request body
    const body = await c.req.json();

    // Prepare headers for downstream request
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add connection token if available
    if (connection.connectionToken) {
      // TODO: Decrypt token using vault when implemented
      headers['Authorization'] = `Bearer ${connection.connectionToken}`;
    }

    // Add custom headers if configured
    if (connection.connectionHeaders) {
      Object.assign(headers, connection.connectionHeaders);
    }

    // Add trace context for distributed tracing
    const span = ctx.tracer.startActiveSpan(
      'mcp.proxy',
      {
        attributes: {
          'connection.id': connectionId,
          'connection.name': connection.name,
          'connection.type': connection.connectionType,
        }
      },
      (span) => span
    );

    // Propagate W3C trace context
    const traceId = span.spanContext().traceId;
    if (traceId) {
      headers['traceparent'] = `00-${traceId}-${span.spanContext().spanId}-01`;
    }

    // Proxy the request to downstream MCP
    const response = await fetch(connection.connectionUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    // Record metrics
    ctx.meter
      .createCounter('connection.proxy.requests', {
        description: 'Number of MCP proxy requests',
      })
      .add(1, {
        'connection.id': connectionId,
        'status': response.status.toString(),
      });

    if (!response.ok) {
      ctx.meter
        .createCounter('connection.proxy.errors', {
          description: 'Number of MCP proxy errors',
        })
        .add(1, {
          'connection.id': connectionId,
          'status': response.status.toString(),
        });
    }

    span.end();

    // Return proxied response
    const responseData = await response.json();
    return c.json(responseData, response.status as ContentfulStatusCode);

  } catch (error) {
    const err = error as Error;

    // Record error
    ctx.meter
      .createCounter('connection.proxy.errors', {
        description: 'Number of MCP proxy errors',
      })
      .add(1, {
        'connection.id': connectionId,
        'error': err.message,
      });

    console.error('Proxy error:', err);

    return c.json({
      error: 'Proxy failed',
      message: err.message,
    }, 500);
  }
});

export default app;


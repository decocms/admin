/**
 * OpenTelemetry Observability Setup
 * 
 * Provides distributed tracing and metrics collection
 * for the MCP Mesh.
 */

import { trace, metrics } from '@opentelemetry/api';

/**
 * Get tracer instance
 */
export const tracer = trace.getTracer('mcp-mesh', '1.0.0');

/**
 * Get meter instance
 */
export const meter = metrics.getMeter('mcp-mesh', '1.0.0');

/**
 * Standard metrics
 * These are created on-demand by tools via ctx.meter
 */
export const standardMetrics = {
  toolExecutionDuration: 'tool.execution.duration',
  toolExecutionCount: 'tool.execution.count',
  toolExecutionErrors: 'tool.execution.errors',
  connectionProxyRequests: 'connection.proxy.requests',
  connectionProxyErrors: 'connection.proxy.errors',
} as const;


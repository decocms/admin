/**
 * OpenTelemetry Observability Setup
 *
 * Provides distributed tracing and metrics collection
 * for the MCP Mesh.
 */

import { trace, metrics } from "@opentelemetry/api";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import type { MetricReader } from "@opentelemetry/sdk-metrics";

/**
 * Create Prometheus exporter as a MetricReader
 * This collects metrics from the SDK and exposes them for Prometheus to scrape
 * preventServerStart: true means we handle the HTTP endpoint ourselves via Hono
 */
export const prometheusExporter = new PrometheusExporter({
  preventServerStart: true,
});

/**
 * Initialize OpenTelemetry SDK
 */
const sdk = new NodeSDK({
  serviceName: "mcp-mesh",
  traceExporter: new OTLPTraceExporter({
    url:
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
      "http://localhost:4318/v1/traces",
  }),
  metricReader: prometheusExporter as unknown as MetricReader,
});

// Start SDK to enable metric collection and tracing
sdk.start();

/**
 * Get tracer instance
 */
export const tracer = trace.getTracer("mcp-mesh", "1.0.0");

/**
 * Get meter instance
 */
export const meter = metrics.getMeter("mcp-mesh", "1.0.0");

/**
 * MCP Mesh API Server
 *
 * Main Hono application with:
 * - Better Auth integration
 * - Context injection middleware
 * - Error handling
 * - CORS support
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "../auth";
import { createMeshContextFactory } from "../core/context-factory";
import type { MeshContext } from "../core/mesh-context";
import { getDb } from "../database";
import { meter, tracer, prometheusExporter } from "../observability";
import { PrometheusSerializer } from "@opentelemetry/exporter-prometheus";
import managementRoutes from "./routes/management";
import proxyRoutes from "./routes/proxy";
import authRoutes from "./routes/auth";
import { serveStatic } from "hono/bun";

// Define Hono variables type
type Variables = {
  meshContext: MeshContext;
};

const app = new Hono<{ Variables: Variables }>();

// ============================================================================
// Middleware
// ============================================================================

// CORS middleware
app.use(
  "/*",
  cors({
    origin: (origin) => {
      // Allow localhost and configured origins
      if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
        return origin;
      }
      // TODO: Configure allowed origins from environment
      return origin;
    },
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "mcp-protocol-version"],
  }),
);

// Request logging
app.use("*", logger());

// ============================================================================
// Health Check
// ============================================================================

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// ============================================================================
// Prometheus Metrics Endpoint
// ============================================================================

// Create serializer for Prometheus text format
const prometheusSerializer = new PrometheusSerializer();

app.get("/metrics", async (c) => {
  try {
    // Collect metrics from the SDK via the Prometheus exporter
    const collectionResult = await prometheusExporter.collect();
    const { resourceMetrics, errors } = collectionResult;

    if (errors.length > 0) {
      console.error("Prometheus exporter errors:", errors);
    }

    // Serialize to Prometheus text format
    const metricsText = prometheusSerializer.serialize(resourceMetrics);

    return c.text(metricsText, 200, {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
    });
  } catch (error) {
    console.error("Error serving metrics:", error);
    return c.text(`# failed to export metrics: ${error}`, 500);
  }
});

// ============================================================================
// Tool Metadata API
// ============================================================================

import { getToolsByCategory, MANAGEMENT_TOOLS } from "../tools/registry";

// Get all management tools (for OAuth consent UI)
app.get("/api/tools/management", (c) => {
  return c.json({
    tools: MANAGEMENT_TOOLS,
    grouped: getToolsByCategory(),
  });
});

// Mount custom auth routes at /api/auth
app.route("/api/auth/custom", authRoutes);

// Mount Better Auth handler for ALL /api/auth/* routes
// This handles:
// - /api/auth/sign-in/email, /api/auth/sign-up/email
// - /api/auth/session
// - /api/auth/authorize (OAuth authorization endpoint)
// - /api/auth/token (OAuth token endpoint)
// - /api/auth/register (Dynamic Client Registration)
// - All other Better Auth endpoints
app.all("/api/auth/*", async (c) => {
  return await auth.handler(c.req.raw);
});

// Mount OAuth discovery metadata endpoints
import {
  oAuthDiscoveryMetadata,
  oAuthProtectedResourceMetadata,
} from "better-auth/plugins";
const handleOAuthProtectedResourceMetadata =
  oAuthProtectedResourceMetadata(auth);
const handleOAuthDiscoveryMetadata = oAuthDiscoveryMetadata(auth);

interface ResourceServerMetadata {
  resource: string;
  authorization_servers: string[];
  jwks_uri: string;
  scopes_supported: string[];
  bearer_methods_supported: string[];
  resource_signing_alg_values_supported: string[];
}
app.get(
  "/mcp/:connectionId/.well-known/oauth-protected-resource/*",
  async (c) => {
    const res = await handleOAuthProtectedResourceMetadata(c.req.raw);
    const data = (await res.json()) as ResourceServerMetadata;
    return Response.json(
      {
        ...data,
        scopes_supported: [
          ...data.scopes_supported,
          `${c.req.param("connectionId")}:*`,
        ],
      },
      res,
    );
  },
);
app.get(
  "/.well-known/oauth-authorization-server/*/:connectionId?",
  async (c) => {
    const connectionId = c.req.param("connectionId") ?? "self";
    const res = await handleOAuthDiscoveryMetadata(c.req.raw);
    const data = await res.json();
    return Response.json(
      { ...data, scopes_supported: [`${connectionId}:*`] },
      res,
    );
  },
);

// ============================================================================
// MeshContext Injection Middleware
// ============================================================================

// Create context factory
const createContext = createMeshContextFactory({
  db: getDb(),
  auth,
  encryption: {
    key: process.env.ENCRYPTION_KEY || "",
  },
  observability: {
    tracer,
    meter,
  },
});

// Inject MeshContext into requests
// Skip auth routes, static files, health check, and metrics - they don't need MeshContext
app.use("*", async (c, next) => {
  const path = c.req.path;

  // Skip MeshContext for auth endpoints, static pages, health check, and metrics
  if (
    path.startsWith("/api/auth/") ||
    path === "/health" ||
    path === "/metrics" ||
    path.startsWith("/.well-known/")
  ) {
    return await next();
  }

  try {
    const ctx = await createContext(c);
    c.set("meshContext", ctx);
    return await next();
  } catch (error) {
    const err = error as Error;

    if (err.name === "UnauthorizedError") {
      return c.json({ error: err.message }, 401);
    }
    if (err.name === "NotFoundError") {
      return c.json({ error: err.message }, 404);
    }

    throw error;
  }
});

// ============================================================================
// Routes
// ============================================================================

app.use("/mcp/:connectionId?", async (c, next) => {
  const meshContext = c.var.meshContext;
  const connectionId = c.req.param("connectionId") ?? "self";
  // Require either user or API key authentication
  if (!meshContext.auth.user?.id && !meshContext.auth.apiKey?.id) {
    const origin = new URL(c.req.url).origin;
    return (c.res = new Response(null, {
      status: 401,
      headers: {
        "WWW-Authenticate": `Bearer realm="mcp",resource_metadata="${origin}/mcp/${connectionId}/.well-known/oauth-protected-resource"`,
      },
    }));
  }
  return await next();
});
// Mount management tools MCP server at /mcp (no connectionId)
// This exposes CONNECTION_* tools via MCP protocol
// Organizations managed via Better Auth organization plugin
// Authentication is handled by context-factory middleware above
app.route("/mcp", managementRoutes);

// Mount MCP proxy routes at /mcp/:connectionId
// Connection IDs are globally unique UUIDs
app.route("/mcp", proxyRoutes);

// ============================================================================
// Error Handlers
// ============================================================================

// Global error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);

  return c.json(
    {
      error: "Internal Server Error",
      message: err.message,
    },
    500,
  );
});

// 404 handler with helpful message for OAuth endpoints
app.notFound((c) => {
  const path = c.req.path;

  return c.json(
    {
      error: "Not Found",
      path,
    },
    404,
  );
});

if (process.env.NODE_ENV === "development") {
  const { devServerProxy } = await import("./utils/dev-server-proxy");
  app.use("*", (c) => devServerProxy(c));
} else {
  // --- Production static serving ---
  app.use("/assets/*", serveStatic({ root: "./dist" })); // serve Vite assets
  app.get("*", serveStatic({ path: "./dist/index.html" })); // SPA fallback
}

export default app;

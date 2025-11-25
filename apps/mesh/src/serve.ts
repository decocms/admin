/**
 * MCP Mesh Server Entry Point
 *
 * Bun automatically serves the default export if it's a Hono app.
 * Start with: bun run src/index.ts
 */

// Import observability module early to initialize OpenTelemetry SDK
import "./observability";
import app from "./api";

const port = parseInt(process.env.PORT || "3000", 10);

// Log startup info
console.log("✅ MCP Mesh starting...");
console.log("");
console.log(`📋 Health check:  http://0.0.0.0:${port}/health`);
console.log(`🔐 Auth endpoints: http://0.0.0.0:${port}/api/auth/*`);
console.log(`🔧 MCP endpoint:   http://0.0.0.0:${port}/mcp`);
console.log(`🌐 Listening on:   0.0.0.0:${port}`);
console.log("");

Bun.serve({
  port,
  hostname: "0.0.0.0", // Listen on all network interfaces (required for K8s)
  fetch: app.fetch,
  development: process.env.NODE_ENV !== "production",
});

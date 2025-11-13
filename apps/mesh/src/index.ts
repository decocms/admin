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
console.log(`📋 Health check:  http://localhost:${port}/health`);
console.log(`🔐 Auth endpoints: http://localhost:${port}/api/auth/*`);
console.log(`🔧 MCP endpoint:   http://localhost:${port}/mcp`);
console.log("");

Bun.serve({
  port,
  fetch: app.fetch,
  development: true,
});

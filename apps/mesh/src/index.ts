/**
 * MCP Mesh Server Entry Point
 *
 * Bundled server entry point for production.
 * Start with: bun run index.js
 * Or: bun run src/index.ts
 */

// Import observability module early to initialize OpenTelemetry SDK
import "./observability";
import app from "./api";

const port = parseInt(process.env.PORT || "8002", 10);

// Log startup info
const dim = "\x1b[2m";
const reset = "\x1b[0m";

console.log("✅ MCP Mesh starting...");
console.log("");
console.log(`${dim}📋 Health check:  http://0.0.0.0:${port}/health${reset}`);
console.log(
  `${dim}🔐 Auth endpoints: http://0.0.0.0:${port}/api/auth/*${reset}`,
);
console.log(`${dim}🔧 MCP endpoint:   http://0.0.0.0:${port}/mcp${reset}`);
console.log("");

Bun.serve({
  port,
  hostname: "0.0.0.0", // Listen on all network interfaces (required for K8s)
  fetch: app.fetch,
  development: process.env.NODE_ENV !== "production",
});

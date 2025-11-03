/**
 * MCP Mesh Server Entry Point
 *
 * Bun automatically serves the default export if it's a Hono app.
 * Start with: bun run src/index.ts
 */

import app from "./api";
import { migrateToLatest } from "./database/migrate";
import indexHtml from "../public/index.html";

const port = parseInt(process.env.PORT || "3000", 10);

// Run migrations before starting server
console.log("🔄 Running database migrations...");
await migrateToLatest();
console.log("");

// Log startup info
console.log("✅ MCP Mesh starting...");
console.log("");
console.log(`📋 Health check:  http://localhost:${port}/health`);
console.log(`🔐 Auth endpoints: http://localhost:${port}/api/auth/*`);
console.log(`🔧 MCP endpoint:   http://localhost:${port}/mcp`);
console.log(`🎨 Sign in page:   http://localhost:${port}/sign-in`);
console.log(`🔑 API keys page:  http://localhost:${port}/api-keys`);
console.log("");

Bun.serve({
  routes: {
    "/": indexHtml,
    "/auth/*": indexHtml,
  },
  port,
  fetch: app.fetch,
  development: true,
});

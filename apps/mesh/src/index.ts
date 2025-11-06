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
console.log("");

const FRONTEND_ROUTES = ["/", "/auth/*", "/login", "/oauth/callback"];

Bun.serve({
  routes: FRONTEND_ROUTES.reduce(
    (acc, route) => {
      acc[route] = indexHtml;
      return acc;
    },
    {} as Record<string, Bun.HTMLBundle>,
  ),
  port,
  fetch: app.fetch,
  development: true,
});

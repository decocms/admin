/**
 * MCP Mesh Entry Point
 *
 * Routes to either migration or server based on command-line arguments.
 * - With --migrate-only: runs migrations only
 * - Without --migrate-only: starts the server
 *
 * Usage:
 *   bun run src/index.ts              # Start server
 *   bun run src/index.ts --migrate-only  # Run migrations
 */

// Make this file a module to allow top-level await
export {};

const args = process.argv.slice(2);
const isMigrateOnly = args.includes("--migrate-only");

if (isMigrateOnly) {
  // Run migrations only
  console.log("🚀 Running migrations...");
  await import("./migrate");
} else {
  // Start the server
  await import("./serve");
}

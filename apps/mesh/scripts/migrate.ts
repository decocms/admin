#!/usr/bin/env bun
/**
 * Database Migration CLI
 *
 * Usage:
 *   bun run scripts/migrate.ts up      # Run pending migrations
 *   bun run scripts/migrate.ts down    # Rollback last migration
 *   bun run scripts/migrate.ts latest  # Migrate to latest (same as up)
 */

import { migrateToLatest, migrateDown } from "../src/database/migrate";

const command = process.argv[2] || "latest";

async function main() {
  console.log(`Running migration command: ${command}\n`);

  try {
    switch (command) {
      case "up":
      case "latest":
        await migrateToLatest();
        break;

      case "down":
        await migrateDown();
        break;

      default:
        console.error(`Unknown command: ${command}`);
        console.error("Usage: bun run scripts/migrate.ts [up|down|latest]");
        process.exit(1);
    }

    console.log("\n✅ Migration completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  }
}

main();

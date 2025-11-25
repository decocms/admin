/**
 * Migration Entry Point
 *
 * This file is the entry point for running migrations.
 * It's separate from migrate.ts to avoid issues with import.meta.main in bundled code.
 */

console.log("🚀 Migration script starting...");

import { migrateToLatest } from "./database/migrate";

console.log("📦 Imported migrateToLatest function");

// Run migrations and exit
(async () => {
  console.log("🏃 Executing migration function...");
  try {
    await migrateToLatest();
    console.log("✅ All migrations completed. Exiting...");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
})();

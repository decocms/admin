/**
 * Database Migration Runner
 *
 * Runs Kysely migrations to create/update database schema
 */

import { Migrator } from "kysely";
import * as path from "node:path";
import migrations from "../../migrations";
import { migrateBetterAuth } from "../auth/migrate";
import { getDb } from "./index";

/**
 * Run all pending migrations
 */
export async function migrateToLatest(): Promise<void> {
  console.log("📊 Getting database instance...");
  const db = getDb();
  console.log("✅ Database instance obtained");

  console.log("🔧 Creating migrator...");

  // In bundled code, __dirname might not be correct, so we use process.cwd()
  const migrationsPath = path.join(process.cwd(), "migrations");
  console.log(`📂 Looking for migrations in: ${migrationsPath}`);

  const migrator = new Migrator({
    db,
    provider: { getMigrations: () => Promise.resolve(migrations) },
  });
  console.log("✅ Migrator created");

  console.log("▶️  Running migrations...");
  const { error, results } = await migrator.migrateToLatest();
  console.log("✅ Migrations executed");

  results?.forEach((it) => {
    if (it.status === "Success") {
      console.log(`✅ Migration "${it.migrationName}" executed successfully`);
    } else if (it.status === "Error") {
      console.error(`❌ Failed to execute migration "${it.migrationName}"`);
    }
  });

  if (error) {
    console.error("Failed to migrate");
    console.error(error);
    // Close database connection before throwing
    await db.destroy().catch(() => {});
    throw error;
  }

  console.log("🎉 All Kysely migrations completed successfully");

  // Run Better Auth migrations programmatically
  await migrateBetterAuth();

  // Close database connection after all migrations
  console.log("🔒 Closing database connection...");
  await db.destroy().catch((err) => {
    console.warn("Warning: Error closing database:", err);
  });
}

/**
 * Rollback the last migration
 */
export async function migrateDown(): Promise<void> {
  const db = getDb();

  const migrator = new Migrator({
    db,
    provider: { getMigrations: () => Promise.resolve(migrations) },
  });

  const { error, results } = await migrator.migrateDown();

  results?.forEach((it) => {
    if (it.status === "Success") {
      console.log(
        `✅ Migration "${it.migrationName}" rolled back successfully`,
      );
    } else if (it.status === "Error") {
      console.error(`❌ Failed to rollback migration "${it.migrationName}"`);
    }
  });

  if (error) {
    console.error("Failed to rollback migration");
    console.error(error);
    throw error;
  }
}

// Note: This file exports functions for use in other modules.
// For running migrations directly, use migrate-entry.ts

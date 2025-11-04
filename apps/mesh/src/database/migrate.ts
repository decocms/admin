/**
 * Database Migration Runner
 *
 * Runs Kysely migrations to create/update database schema
 */

import { promises as fs } from "fs";
import * as path from "path";
import { Migrator, FileMigrationProvider } from "kysely";
import { getDb } from "./index";

/**
 * Run all pending migrations
 */
export async function migrateToLatest(): Promise<void> {
  const db = getDb();

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      // Absolute path to migrations folder
      migrationFolder: path.join(__dirname, "../../migrations"),
    }),
  });

  const { error, results } = await migrator.migrateToLatest();

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
    throw error;
  }

  console.log("🎉 All migrations completed successfully");
}

/**
 * Rollback the last migration
 */
export async function migrateDown(): Promise<void> {
  const db = getDb();

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, "../../migrations"),
    }),
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

if (import.meta.main) {
  await migrateToLatest();
  process.exit(0);
}

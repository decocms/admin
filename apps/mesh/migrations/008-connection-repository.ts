/**
 * Connection Repository Migration
 *
 * Adds repository field to connections table.
 * This allows storing repository info for README display.
 */

import { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // Add repository field to connections table (JSON object with url, source, subfolder)
  await db.schema
    .alterTable("connections")
    .addColumn("repository", "text") // JSON object
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Remove repository field
  await db.schema.alterTable("connections").dropColumn("repository").execute();
}


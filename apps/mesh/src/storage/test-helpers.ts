/**
 * Test Helpers for Storage Tests
 * Creates minimal schema for testing without full migrations
 */

import type { Kysely } from "kysely";
import type { Database } from "./types";

/**
 * Create minimal test schema for in-memory SQLite
 */
export async function createTestSchema(db: Kysely<Database>): Promise<void> {
  console.log("Creating test schema...");

  // Users table
  await db.schema
    .createTable("users")
    .ifNotExists()
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("email", "text", (col) => col.notNull().unique())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("role", "text", (col) => col.notNull().defaultTo("user"))
    .addColumn("createdAt", "text", (col) => col.notNull())
    .addColumn("updatedAt", "text", (col) => col.notNull())
    .execute();

  // Connections table (organization-scoped)
  await db.schema
    .createTable("connections")
    .ifNotExists()
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("organizationId", "text", (col) => col.notNull())
    .addColumn("createdById", "text", (col) => col.notNull())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("description", "text")
    .addColumn("icon", "text")
    .addColumn("appName", "text")
    .addColumn("appId", "text")
    .addColumn("connectionType", "text", (col) => col.notNull())
    .addColumn("connectionUrl", "text", (col) => col.notNull())
    .addColumn("connectionToken", "text")
    .addColumn("connectionHeaders", "text")
    .addColumn("oauthConfig", "text")
    .addColumn("metadata", "text")
    .addColumn("tools", "text")
    .addColumn("bindings", "text")
    .addColumn("status", "text", (col) => col.notNull().defaultTo("active"))
    .addColumn("createdAt", "text", (col) => col.notNull())
    .addColumn("updatedAt", "text", (col) => col.notNull())
    .execute();

  // API Keys table
  await db.schema
    .createTable("api_keys")
    .ifNotExists()
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("userId", "text", (col) => col.notNull())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("hashedKey", "text", (col) => col.notNull().unique())
    .addColumn("permissions", "text", (col) => col.notNull())
    .addColumn("expiresAt", "text")
    .addColumn("remaining", "integer")
    .addColumn("metadata", "text")
    .addColumn("createdAt", "text", (col) => col.notNull())
    .addColumn("updatedAt", "text", (col) => col.notNull())
    .execute();

  // Audit Logs table
  await db.schema
    .createTable("audit_logs")
    .ifNotExists()
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("organizationId", "text")
    .addColumn("userId", "text")
    .addColumn("connectionId", "text")
    .addColumn("toolName", "text", (col) => col.notNull())
    .addColumn("allowed", "integer", (col) => col.notNull())
    .addColumn("duration", "integer")
    .addColumn("timestamp", "text", (col) => col.notNull())
    .addColumn("requestMetadata", "text")
    .execute();
}

/**
 * Drop all test tables
 */
export async function dropTestSchema(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("audit_logs").ifExists().execute();
  await db.schema.dropTable("connections").ifExists().execute();
  await db.schema.dropTable("api_keys").ifExists().execute();
  await db.schema.dropTable("users").ifExists().execute();
}

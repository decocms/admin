/**
 * Better Auth Migration Runner
 *
 * Runs Better Auth migrations programmatically without requiring the CLI.
 * This gets bundled with the application, avoiding the need for node_modules.
 *
 * IMPORTANT: This file creates a minimal auth configuration to avoid bundling
 * the entire application (tools registry, plugins, etc.) which would cause OOM.
 */

import { getMigrations } from "better-auth/db";
import { betterAuth } from "better-auth";
import {
  admin as adminPlugin,
  apiKey,
  mcp,
  openAPI,
  organization,
} from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
} from "better-auth/plugins/organization/access";
import { BunWorkerDialect } from "kysely-bun-worker";
import path from "path";

/**
 * Get database URL - inlined here to avoid importing the full auth/index
 * which would pull in the entire tools registry
 */
function getDatabaseUrl(): string {
  const databaseUrl =
    process.env.DATABASE_URL ||
    `file:${path.join(process.cwd(), "data/mesh.db")}`;
  console.log(
    `[Auth] Initializing Better Auth with database: ${databaseUrl} at ${process.cwd()}`,
  );
  return databaseUrl;
}

/**
 * Create a minimal auth configuration for migrations only.
 * This avoids loading the tools registry and other heavy dependencies.
 *
 * Note: We use minimal plugin configuration here. The schema will be
 * the same, but the roles/permissions are simplified for migration purposes.
 */
function createMigrationAuthConfig() {
  // Create minimal access control without loading all tools
  const ac = createAccessControl(defaultStatements);

  const user = ac.newRole(adminAc.statements);
  const admin = ac.newRole(adminAc.statements);
  const owner = ac.newRole(adminAc.statements);

  return betterAuth({
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    database: new BunWorkerDialect({
      url: getDatabaseUrl(),
    }),
    emailAndPassword: {
      enabled: true,
    },
    // Include only the plugins needed for schema generation
    // No need for full configuration, just enough to generate the schema
    plugins: [
      organization({
        ac,
        creatorRole: "owner",
        allowUserToCreateOrganization: true,
        roles: {
          user,
          admin,
          owner,
        },
      }),
      mcp({
        loginPage: "/auth/sign-in",
      }),
      apiKey(),
      adminPlugin(),
      openAPI(),
    ],
  });
}

/**
 * Run Better Auth migrations programmatically
 */
export async function migrateBetterAuth(): Promise<void> {
  console.log("🔐 Running Better Auth migrations...");

  try {
    // Create minimal auth config for migrations only
    const authConfig = createMigrationAuthConfig();

    // Get migration info from Better Auth
    // This returns tables to be created/updated and a function to run migrations
    const { toBeAdded, toBeCreated, runMigrations } = await getMigrations(
      authConfig.options,
    );

    // Check if any migrations are needed
    if (!toBeAdded.length && !toBeCreated.length) {
      console.log("✅ Better Auth schema is up to date (no migrations needed)");
      return;
    }

    // Log what will be migrated
    console.log("📋 Better Auth will create/update the following tables:");
    for (const table of [...toBeCreated, ...toBeAdded]) {
      console.log(`   - ${table.table}`);
    }

    // Run the migrations
    await runMigrations();

    console.log("✅ Better Auth migrations completed successfully");
  } catch (error) {
    // If migration fails, log but don't crash the app
    // Better Auth will attempt to create tables on first request
    console.warn(
      "⚠️  Better Auth migration failed (tables may be created on first use):",
      error,
    );
  }
}

// Allow running directly
if (import.meta.main) {
  await migrateBetterAuth();
  process.exit(0);
}

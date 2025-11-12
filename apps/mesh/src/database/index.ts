/**
 * Database Factory for MCP Mesh
 *
 * Auto-detects database dialect from DATABASE_URL and returns configured Kysely instance.
 * Supports SQLite (default) and PostgreSQL.
 *
 * The dialect is specified ONCE at initialization, not in schema files.
 */

import { existsSync, mkdirSync } from "fs";
import { Kysely, PostgresDialect, sql } from "kysely";
import { BunWorkerDialect } from "kysely-bun-worker";
import { Pool } from "pg";
import type { Database as DatabaseSchema } from "../storage/types";
import { getDatabaseUrl } from "@/auth";

/**
 * Create Kysely database instance with auto-detected dialect
 */
export function createDatabase(databaseUrl?: string): Kysely<DatabaseSchema> {
  let url = databaseUrl || "file:./data/mesh.db";

  // Handle special case: ":memory:" without protocol
  if (url === ":memory:") {
    return createSqliteDatabase(":memory:");
  }

  url = url.startsWith("/") ? `file://${url}` : url;

  const parsed = new URL(url);
  const protocol = parsed.protocol.replace(":", "");

  switch (protocol) {
    case "postgres":
    case "postgresql":
      return createPostgresDatabase(url);

    case "sqlite":
    case "file":
      return createSqliteDatabase(parsed.pathname);

    default:
      throw new Error(
        `Unsupported database protocol: ${protocol}. ` +
          `Supported protocols: postgres://, postgresql://, sqlite://, file://`,
      );
  }
}

/**
 * Create PostgreSQL database connection
 */
function createPostgresDatabase(
  connectionString: string,
): Kysely<DatabaseSchema> {
  const dialect = new PostgresDialect({
    pool: new Pool({
      connectionString,
      max: 10, // Connection pool size
    }),
  });

  return new Kysely<DatabaseSchema>({ dialect });
}

/**
 * Create SQLite database connection using BunWorkerDialect
 * This is optimized for Bun's native SQLite implementation
 */
function createSqliteDatabase(dbPath: string): Kysely<DatabaseSchema> {
  // Ensure directory exists for file-based databases
  if (dbPath !== ":memory:" && dbPath !== "/" && dbPath) {
    const dir = dbPath.substring(0, dbPath.lastIndexOf("/"));
    if (dir && dir !== "/" && !existsSync(dir)) {
      try {
        mkdirSync(dir, { recursive: true });
      } catch {
        // If directory creation fails, use in-memory database
        console.warn(
          `Failed to create directory ${dir}, using in-memory database`,
        );
        dbPath = ":memory:";
      }
    }
  }

  console.log("Creating SQLite database at", dbPath);

  const dialect = new BunWorkerDialect({
    url: dbPath || ":memory:",
    onCreateConnection: async (connection) => {
      // Enable WAL mode for better concurrency
      // WAL allows multiple readers while a write is in progress
      await connection.executeQuery(
        sql`PRAGMA journal_mode = WAL;`.compile(
          new Kysely<DatabaseSchema>({ dialect }),
        ),
      );
      await connection.executeQuery(
        sql`PRAGMA busy_timeout = 5000;`.compile(
          new Kysely<DatabaseSchema>({ dialect }),
        ),
      );
    },
  });

  const db = new Kysely<DatabaseSchema>({ dialect });

  // Enable WAL mode and busy timeout for non-memory databases
  if (dbPath !== ":memory:") {
    // These pragmas need to be run after the database is created
    sql`PRAGMA journal_mode = WAL;`.execute(db).catch(() => {
      // Ignore errors - might already be in WAL mode
    });
    sql`PRAGMA busy_timeout = 5000;`.execute(db).catch(() => {
      // Ignore errors
    });
  }

  return db;
}

/**
 * Close database connection
 * Useful for graceful shutdown
 */
export async function closeDatabase(
  database: Kysely<DatabaseSchema>,
): Promise<void> {
  await database.destroy();
}

/**
 * Get database dialect name
 */
export function getDatabaseDialect(database: Kysely<DatabaseSchema>): string {
  // Access internal executor to get dialect (using unknown for type safety)
  const db = database as unknown as {
    getExecutor?: () => {
      adapter?: {
        connectionProvider?: {
          constructor?: {
            name?: string;
          };
        };
      };
    };
  };
  return (
    db.getExecutor?.()?.adapter?.connectionProvider?.constructor?.name ||
    "unknown"
  );
}

/**
 * Default database instance (singleton)
 * Lazy-initialized to avoid errors during module import
 * Call this function to get the database instance
 */
let dbInstance: Kysely<DatabaseSchema> | null = null;

export function getDb(): Kysely<DatabaseSchema> {
  if (!dbInstance) {
    dbInstance = createDatabase(getDatabaseUrl());
  }
  return dbInstance;
}

/**
 * Export db for compatibility (lazy-initialized)
 */
export const db = new Proxy({} as Kysely<DatabaseSchema>, {
  get(_, prop) {
    return getDb()[prop as keyof Kysely<DatabaseSchema>];
  },
});

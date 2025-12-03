/**
 * Database Factory for MCP Mesh
 *
 * Auto-detects database dialect from DATABASE_URL and returns configured Kysely instance.
 * Supports SQLite (default) and PostgreSQL.
 *
 * The dialect is specified ONCE at initialization, not in schema files.
 */

import { existsSync, mkdirSync } from "fs";
import { type Dialect, Kysely, PostgresDialect, sql } from "kysely";
import { BunWorkerDialect } from "kysely-bun-worker";
import { Pool } from "pg";
import * as path from "path";
import type { Database as DatabaseSchema } from "../storage/types";

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Supported database types
 */
export type DatabaseType = "sqlite" | "postgres";

/**
 * Database configuration interface
 */
export interface DatabaseConfig {
  type: DatabaseType;
  connectionString: string;
  options?: {
    maxConnections?: number; // For PostgreSQL
    enableWAL?: boolean; // For SQLite
    busyTimeout?: number; // For SQLite
  };
}

/**
 * Interface for database implementations
 * Each supported database must implement this interface
 */
export interface SupportedDatabase {
  /**
   * Database type identifier
   */
  readonly type: DatabaseType;

  /**
   * Create a Kysely dialect for this database
   */
  createDialect(config: DatabaseConfig): Dialect;

  /**
   * Create a full Kysely instance for this database
   */
  createInstance(config: DatabaseConfig): Kysely<DatabaseSchema>;

  /**
   * Post-creation setup (e.g., SQLite pragmas)
   */
  postCreateSetup?(db: Kysely<DatabaseSchema>, config: DatabaseConfig): void;
}

// ============================================================================
// PostgreSQL Implementation
// ============================================================================

class PostgresDatabase implements SupportedDatabase {
  readonly type: DatabaseType = "postgres";

  createDialect(config: DatabaseConfig): Dialect {
    return new PostgresDialect({
      pool: new Pool({
        connectionString: config.connectionString,
        max: config.options?.maxConnections || 10,
        ssl: process.env.DATABASE_PG_SSL === "true" ? true : false,
      }),
    });
  }

  createInstance(config: DatabaseConfig): Kysely<DatabaseSchema> {
    const dialect = this.createDialect(config);
    return new Kysely<DatabaseSchema>({ dialect });
  }
}

// ============================================================================
// SQLite Implementation
// ============================================================================

class SqliteDatabase implements SupportedDatabase {
  readonly type: DatabaseType = "sqlite";

  createDialect(config: DatabaseConfig): Dialect {
    let dbPath = this.extractPath(config.connectionString);

    // Ensure directory exists for file-based databases
    dbPath = this.ensureDirectory(dbPath);

    return new BunWorkerDialect({
      url: dbPath || ":memory:",
    });
  }

  createInstance(config: DatabaseConfig): Kysely<DatabaseSchema> {
    const dialect = this.createDialect(config);
    const db = new Kysely<DatabaseSchema>({ dialect });

    // Run post-creation setup
    this.postCreateSetup?.(db, config);

    return db;
  }

  postCreateSetup(db: Kysely<DatabaseSchema>, config: DatabaseConfig): void {
    const dbPath = this.extractPath(config.connectionString);

    // Enable WAL mode and busy timeout for non-memory databases
    if (dbPath !== ":memory:" && config.options?.enableWAL !== false) {
      sql`PRAGMA journal_mode = WAL;`.execute(db).catch(() => {
        // Ignore errors - might already be in WAL mode
      });
    }

    if (dbPath !== ":memory:") {
      const timeout = config.options?.busyTimeout || 5000;
      sql`PRAGMA busy_timeout = ${timeout};`.execute(db).catch(() => {
        // Ignore errors
      });
    }
  }

  private extractPath(connectionString: string): string {
    // Handle ":memory:" special case
    if (connectionString === ":memory:") {
      return ":memory:";
    }

    // Parse URL if it has a protocol
    if (connectionString.includes("://")) {
      const url = new URL(connectionString);
      return url.pathname;
    }

    // Otherwise treat as direct path
    return connectionString;
  }

  private ensureDirectory(dbPath: string): string {
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
          return ":memory:";
        }
      }
    }
    return dbPath;
  }
}

// ============================================================================
// Database Registry
// ============================================================================

const DATABASES: Record<DatabaseType, SupportedDatabase> = {
  sqlite: new SqliteDatabase(),
  postgres: new PostgresDatabase(),
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Get database URL from environment or default
 */
export function getDatabaseUrl(): string {
  const databaseUrl =
    process.env.DATABASE_URL ||
    `file:${path.join(process.cwd(), "data/mesh.db")}`;
  return databaseUrl;
}

/**
 * Parse database URL and extract configuration
 */
function parseDatabaseUrl(databaseUrl?: string): DatabaseConfig {
  let url = databaseUrl || "file:./data/mesh.db";

  // Handle special case: ":memory:" without protocol
  if (url === ":memory:") {
    return {
      type: "sqlite",
      connectionString: ":memory:",
    };
  }

  // Add file:// prefix for absolute paths
  url = url.startsWith("/") ? `file://${url}` : url;

  const parsed = new URL(url);
  const protocol = parsed.protocol.replace(":", "");

  switch (protocol) {
    case "postgres":
    case "postgresql":
      return {
        type: "postgres",
        connectionString: url,
      };

    case "sqlite":
    case "file":
      return {
        type: "sqlite",
        connectionString: parsed.pathname,
      };

    default:
      throw new Error(
        `Unsupported database protocol: ${protocol}. ` +
          `Supported protocols: postgres://, postgresql://, sqlite://, file://`,
      );
  }
}

/**
 * Get the database implementation for a given type
 */
function getDatabaseImpl(type: DatabaseType): SupportedDatabase {
  return DATABASES[type];
}

/**
 * Create a Kysely dialect for the given database URL
 * This allows you to create a dialect without creating the full Kysely instance
 */
export function getDbDialect(databaseUrl?: string): Dialect {
  const config = parseDatabaseUrl(databaseUrl);
  const impl = getDatabaseImpl(config.type);
  return impl.createDialect(config);
}

/**
 * Create Kysely database instance with auto-detected dialect
 */
export function createDatabase(databaseUrl?: string): Kysely<DatabaseSchema> {
  const config = parseDatabaseUrl(databaseUrl);
  const impl = getDatabaseImpl(config.type);
  return impl.createInstance(config);
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

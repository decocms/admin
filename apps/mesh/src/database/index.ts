/**
 * Database Factory for MCP Mesh
 * 
 * Auto-detects database dialect from DATABASE_URL and returns configured Kysely instance.
 * Supports SQLite (default) and PostgreSQL.
 * 
 * The dialect is specified ONCE at initialization, not in schema files.
 */

import { existsSync, mkdirSync } from 'fs';
import { Kysely, PostgresDialect } from 'kysely';
import { BunWorkerDialect } from 'kysely-bun-worker';
import { Pool } from 'pg';
import type { Database as DatabaseSchema } from '../storage/types';

/**
 * Create Kysely database instance with auto-detected dialect
 */
export function createDatabase(databaseUrl?: string): Kysely<DatabaseSchema> {
  const url = databaseUrl || 'file:./data/mesh.db';

  // Handle special case: ":memory:" without protocol
  if (url === ':memory:') {
    return createSqliteDatabase(':memory:');
  }

  const parsed = new URL(url);
  const protocol = parsed.protocol.replace(':', '');

  switch (protocol) {
    case 'postgres':
    case 'postgresql':
      return createPostgresDatabase(url);

    case 'sqlite':
    case 'file':
      return createSqliteDatabase(parsed.pathname);

    default:
      throw new Error(
        `Unsupported database protocol: ${protocol}. ` +
        `Supported protocols: postgres://, postgresql://, sqlite://, file://`
      );
  }
}

/**
 * Create PostgreSQL database connection
 */
function createPostgresDatabase(connectionString: string): Kysely<DatabaseSchema> {
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
  if (dbPath !== ':memory:' && dbPath !== '/' && dbPath) {
    const dir = dbPath.substring(0, dbPath.lastIndexOf('/'));
    if (dir && dir !== '/' && !existsSync(dir)) {
      try {
        mkdirSync(dir, { recursive: true });
      } catch (error) {
        // If directory creation fails, use in-memory database
        console.warn(`Failed to create directory ${dir}, using in-memory database`);
        dbPath = ':memory:';
      }
    }
  }

  const dialect = new BunWorkerDialect({
    url: dbPath || ':memory:',
  });

  return new Kysely<DatabaseSchema>({ dialect });
}


/**
 * Close database connection
 * Useful for graceful shutdown
 */
export async function closeDatabase(database: Kysely<DatabaseSchema>): Promise<void> {
  await database.destroy();
}

/**
 * Get database dialect name
 */
export function getDatabaseDialect(database: Kysely<DatabaseSchema>): string {
  // Access internal executor to get dialect
  return (database as any).getExecutor?.()?.adapter?.connectionProvider?.constructor?.name || 'unknown';
}

/**
 * Default database instance (singleton)
 * Lazy-initialized to avoid errors during module import
 * Call this function to get the database instance
 */
let dbInstance: Kysely<DatabaseSchema> | null = null;

export function getDb(): Kysely<DatabaseSchema> {
  if (!dbInstance) {
    dbInstance = createDatabase(process.env.DATABASE_URL || ':memory:');
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


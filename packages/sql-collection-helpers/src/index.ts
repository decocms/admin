/**
 * @decocms/sql-collection-helpers
 *
 * Dynamic MCP tool generation from SQL database schemas.
 * Supports PostgreSQL and SQLite with lazy SWR-cached introspection.
 *
 * ## Database Implementations
 *
 * ### PostgreSQL
 * - Uses `postgres` package (raw driver)
 * - Implementation: `PostgresAdapter`
 *
 * ### SQLite - Node.js
 * - Uses `better-sqlite3` package
 * - Implementation: `SqliteAdapter`
 *
 * ### SQLite - Bun Runtime
 * - Uses `bun:sqlite` (native)
 * - Implementation: `BunSqliteAdapter`
 * - Automatically used when running in Bun
 */

export { createCollectionTools } from "./tool-factory";

export type {
  DatabaseConfig,
  PostgresConfig,
  SqliteConfig,
  CollectionConfig,
  CollectionMode,
  MutationConfig,
  TableMutationConfig,
  CacheConfig,
  CreateCollectionToolsConfig,
  DatabaseAdapter,
  TableMetadata,
  ColumnMetadata,
  SqlType,
  AuditFields,
  QueryParams,
  GeneratedSchemas,
} from "./types";

export { getGlobalCache, resetGlobalCache, IntrospectionCache } from "./cache";
export {
  generateSchemas,
  normalizeSqlType,
  detectAuditFields,
} from "./schema-generator";

// PostgreSQL implementation
export { PostgresAdapter } from "./implementations/postgres";
export { PostgresIntrospector } from "./introspection/postgres";

// SQLite implementation for Node.js (better-sqlite3)
export { SqliteAdapter } from "./implementations/sqlite";
export { SqliteIntrospector } from "./introspection/sqlite";

// SQLite implementation for Bun runtime (bun:sqlite)
export { BunSqliteAdapter } from "./implementations/bun-sqlite";
export { SqliteIntrospectorBun } from "./introspection/bun-sqlite";

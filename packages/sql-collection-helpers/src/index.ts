/**
 * @decocms/sql-collection-helpers
 *
 * Dynamic MCP tool generation from SQL database schemas.
 * Supports PostgreSQL and SQLite with lazy SWR-cached introspection.
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
export { generateSchemas, normalizeSqlType, detectAuditFields } from "./schema-generator";
export { PostgresAdapter } from "./implementations/postgres";
export { SqliteAdapter } from "./implementations/sqlite";
export { PostgresIntrospector } from "./introspection/postgres";
export { SqliteIntrospector } from "./introspection/sqlite";


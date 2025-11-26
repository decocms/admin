/**
 * Core Types and Interfaces for SQL Collection Helpers
 *
 * This module defines the configuration types and database metadata structures
 * used throughout the package.
 */

import type { z } from "zod";

/**
 * PostgreSQL database configuration
 */
export interface PostgresConfig {
  type: "postgres";
  connectionString: string;
  schema?: string; // Default: 'public'
}

/**
 * SQLite database configuration
 */
export interface SqliteConfig {
  type: "sqlite";
  filename: string; // Path to SQLite database file or ':memory:'
}

/**
 * Union type for all supported database configurations
 */
export type DatabaseConfig = PostgresConfig | SqliteConfig;

/**
 * Collection filtering mode
 */
export type CollectionMode = "all" | "include" | "exclude";

/**
 * Configuration for which tables to expose as collections
 */
export interface CollectionConfig {
  /**
   * Mode for table filtering
   * - 'all': Export all tables as collections (default)
   * - 'include': Only export tables listed in `tables`
   * - 'exclude': Export all tables except those listed in `tables`
   */
  mode: CollectionMode;

  /**
   * List of table names to include or exclude based on mode
   */
  tables?: string[];
}

/**
 * Per-table mutation configuration
 */
export interface TableMutationConfig {
  /**
   * Table name
   */
  table: string;

  /**
   * Whether mutations are enabled for this table
   */
  enabled: boolean;
}

/**
 * Configuration for mutation operations (CREATE/UPDATE/DELETE)
 */
export interface MutationConfig {
  /**
   * Default mutation behavior for all tables
   * @default false
   */
  defaultEnabled?: boolean;

  /**
   * Per-table overrides
   */
  overrides?: TableMutationConfig[];
}

/**
 * SWR cache configuration
 */
export interface CacheConfig {
  /**
   * Time-to-live for cached introspection results in milliseconds
   * @default 60000 (60 seconds)
   */
  ttl?: number;

  /**
   * Whether to enable SWR (stale-while-revalidate) behavior
   * @default true
   */
  enabled?: boolean;
}

/**
 * SQL data type categories
 */
export type SqlType =
  | "string"
  | "number"
  | "boolean"
  | "datetime"
  | "date"
  | "time"
  | "json"
  | "binary"
  | "unknown";

/**
 * Database column metadata
 */
export interface ColumnMetadata {
  /**
   * Column name
   */
  name: string;

  /**
   * Normalized SQL type
   */
  type: SqlType;

  /**
   * Raw database type (e.g., 'VARCHAR(255)', 'INTEGER', 'TIMESTAMP')
   */
  rawType: string;

  /**
   * Whether the column is nullable
   */
  nullable: boolean;

  /**
   * Whether this is the primary key
   */
  isPrimaryKey: boolean;

  /**
   * Whether this column has a default value
   */
  hasDefault: boolean;

  /**
   * Default value expression (if any)
   */
  defaultValue?: string;

  /**
   * Whether this is an auto-increment/serial column
   */
  isAutoIncrement: boolean;
}

/**
 * Audit field detection result
 */
export interface AuditFields {
  createdAt?: string; // Column name for created timestamp
  updatedAt?: string; // Column name for updated timestamp
  createdBy?: string; // Column name for created user ID
  updatedBy?: string; // Column name for updated user ID
}

/**
 * Table metadata including columns and audit fields
 */
export interface TableMetadata {
  /**
   * Table name
   */
  name: string;

  /**
   * Schema name (PostgreSQL only)
   */
  schema?: string;

  /**
   * List of columns
   */
  columns: ColumnMetadata[];

  /**
   * Primary key column name (supports single-column PKs only)
   */
  primaryKey: string | null;

  /**
   * Detected audit fields
   */
  auditFields: AuditFields;
}

/**
 * Query filter parameters for LIST operations
 */
export interface QueryParams {
  where?: Record<string, unknown>;
  orderBy?: Array<{ field: string[]; direction: "asc" | "desc" }>;
  limit?: number;
  offset?: number;
}

/**
 * Generic database adapter interface
 *
 * This interface abstracts database-specific operations for introspection and CRUD
 */
export interface DatabaseAdapter {
  /**
   * Introspect database schema to get table metadata
   */
  introspect(): Promise<TableMetadata[]>;

  /**
   * Execute a query with filtering, sorting, and pagination
   */
  query(
    table: string,
    params: QueryParams,
  ): Promise<Array<Record<string, unknown>>>;

  /**
   * Get a single record by primary key
   */
  getById(
    table: string,
    id: string | number,
    primaryKey: string,
  ): Promise<Record<string, unknown> | null>;

  /**
   * Insert a new record
   */
  insert(
    table: string,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;

  /**
   * Update an existing record by primary key
   */
  update(
    table: string,
    id: string | number,
    primaryKey: string,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;

  /**
   * Delete a record by primary key
   */
  delete(
    table: string,
    id: string | number,
    primaryKey: string,
  ): Promise<boolean>;

  /**
   * Close database connection
   */
  close(): Promise<void>;
}

/**
 * Generated Zod schemas for a table
 */
export interface GeneratedSchemas {
  /**
   * Full entity schema (all columns)
   */
  entitySchema: z.ZodObject<any>;

  /**
   * Insert schema (omit auto-generated fields)
   */
  insertSchema: z.ZodObject<any>;

  /**
   * Update schema (all fields optional except ID)
   */
  updateSchema: z.ZodObject<any>;
}

/**
 * Configuration for createCollectionTools
 */
export interface CreateCollectionToolsConfig {
  /**
   * Database configuration
   */
  database: DatabaseConfig;

  /**
   * Collection filtering configuration
   * @default { mode: 'all' }
   */
  collections?: CollectionConfig;

  /**
   * Mutation configuration
   * @default { defaultEnabled: false }
   */
  mutations?: MutationConfig;

  /**
   * Cache configuration
   * @default { ttl: 60000, enabled: true }
   */
  cache?: CacheConfig;
}

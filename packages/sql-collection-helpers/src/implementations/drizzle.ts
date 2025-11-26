/**
 * Drizzle ORM Database Adapter Implementation
 *
 * Implements CRUD operations using Drizzle ORM with lazy initialization.
 * The database client is created on-demand using a factory function that
 * receives the execution context (which provides access to env).
 */

import type { SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import { sql } from "drizzle-orm";
import type {
  DatabaseAdapter,
  QueryParams,
  TableMetadata,
  ColumnMetadata,
  SqlType,
} from "../types";
import type { WhereExpression } from "@decocms/bindings/collections";

/**
 * Factory function that creates a Drizzle database instance
 * Gets called with the execution context which provides env access
 */
export type DrizzleFactory = (context: {
  runtimeContext?: { get: (key: string) => unknown };
}) => SqliteRemoteDatabase<Record<string, never>>;

/**
 * Drizzle adapter for collection operations
 * Uses lazy initialization - the database client is created on first use
 */
export class DrizzleAdapter implements DatabaseAdapter {
  private dbFactory: DrizzleFactory;
  private tableColumnsCache: Map<string, Set<string>> = new Map();
  private tableMetadataCache: TableMetadata[] | null = null;

  constructor(dbFactory: DrizzleFactory) {
    this.dbFactory = dbFactory;
  }

  /**
   * Get database instance (lazily created)
   * For introspection, we don't have context so we pass empty context
   */
  private getDb(context?: {
    runtimeContext?: { get: (key: string) => unknown };
  }): SqliteRemoteDatabase<Record<string, never>> {
    return this.dbFactory(context ?? {});
  }

  /**
   * Introspect database schema using SQLite system tables
   */
  async introspect(): Promise<TableMetadata[]> {
    // Return cached metadata if available
    if (this.tableMetadataCache) {
      return this.tableMetadataCache;
    }

    const db = this.getDb();

    // Get all tables
    // Note: db.all with sql`` returns arrays when using proxy, not objects
    const tablesResultRaw = await db.all(sql`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
        AND name NOT LIKE 'sqlite_%'
        AND name NOT LIKE '_cf_%'
        AND name NOT LIKE 'd1_%'
        AND name NOT LIKE 'mastra_%'
      ORDER BY name
    `);

    // Map arrays to objects [name] => {name}
    const tablesResult = (tablesResultRaw as unknown[]).map((row: unknown) => ({
      name: Array.isArray(row) ? row[0] : (row as { name: string }).name,
    }));

    const tables: TableMetadata[] = [];

    for (const table of tablesResult) {
      // Get table info - returns arrays: [cid, name, type, notnull, dflt_value, pk]
      const columnsResultRaw = await db.all(
        sql.raw(`PRAGMA table_info("${table.name}")`),
      );

      // Map arrays to objects
      const columnsResult = (columnsResultRaw as unknown[]).map(
        (row: unknown) => {
          if (Array.isArray(row)) {
            return {
              cid: row[0],
              name: row[1],
              type: row[2],
              notnull: row[3],
              dflt_value: row[4],
              pk: row[5],
            };
          }
          return row as {
            cid: number;
            name: string;
            type: string;
            notnull: number;
            dflt_value: string | null;
            pk: number;
          };
        },
      );

      const columns: ColumnMetadata[] = columnsResult.map((col) => ({
        name: col.name,
        type: col.type.toUpperCase() as SqlType,
        rawType: col.type,
        nullable: col.notnull === 0,
        isPrimaryKey: col.pk > 0,
        hasDefault: col.dflt_value !== null,
        defaultValue: col.dflt_value || undefined,
        isAutoIncrement: col.pk > 0 && col.type.toUpperCase() === "INTEGER",
      }));

      // Find primary key
      const pkColumn = columns.find((c) => c.isPrimaryKey);

      // Detect audit fields
      const auditFields: TableMetadata["auditFields"] = {};
      const columnNames = columns.map((c) => c.name.toLowerCase());

      if (columnNames.includes("created_at")) {
        auditFields.createdAt = "created_at";
      } else if (columnNames.includes("createdat")) {
        auditFields.createdAt = "createdAt";
      }

      if (columnNames.includes("updated_at")) {
        auditFields.updatedAt = "updated_at";
      } else if (columnNames.includes("updatedat")) {
        auditFields.updatedAt = "updatedAt";
      }

      if (columnNames.includes("created_by")) {
        auditFields.createdBy = "created_by";
      } else if (columnNames.includes("createdby")) {
        auditFields.createdBy = "createdBy";
      }

      if (columnNames.includes("updated_by")) {
        auditFields.updatedBy = "updated_by";
      } else if (columnNames.includes("updatedby")) {
        auditFields.updatedBy = "updatedBy";
      }

      tables.push({
        name: table.name,
        primaryKey: pkColumn?.name ?? null,
        columns,
        auditFields,
      });
    }

    // Cache the metadata
    this.tableMetadataCache = tables;

    return tables;
  }

  async query(
    table: string,
    params: QueryParams,
    context?: { runtimeContext?: { get: (key: string) => unknown } },
  ): Promise<Array<Record<string, unknown>>> {
    // Validate table name
    if (!this.validateIdentifier(table)) {
      throw new Error(
        `Invalid table name: "${table}". Must match [A-Za-z_][A-Za-z0-9_]*`,
      );
    }

    const { where, orderBy, limit, offset } = params;
    const db = this.getDb(context);

    // Build query dynamically
    let query = `SELECT * FROM "${table}"`;
    const queryParams: unknown[] = [];
    let paramIndex = 1;

    // Add WHERE clause if provided
    if (where) {
      const whereClause = this.buildWhereClause(
        where as WhereExpression,
        queryParams,
        paramIndex,
      );
      if (whereClause.clause) {
        query += ` WHERE ${whereClause.clause}`;
        paramIndex = whereClause.nextIndex;
      }
    }

    // Add ORDER BY clause
    if (orderBy && orderBy.length > 0) {
      const orderClauses = orderBy.map((order) => {
        const sanitizedField = this.sanitizeOrderByField(order.field);
        const sanitizedDirection = this.sanitizeOrderByDirection(
          order.direction,
        );
        return `${sanitizedField} ${sanitizedDirection}`;
      });
      query += ` ORDER BY ${orderClauses.join(", ")}`;
    }

    // Add LIMIT and OFFSET
    if (limit !== undefined) {
      query += ` LIMIT ?`;
      queryParams.push(limit);
    }
    if (offset !== undefined) {
      query += ` OFFSET ?`;
      queryParams.push(offset);
    }

    // Build parameterized query with inlined params
    const sqlQuery = this.buildSQL(query, queryParams);
    const result = await db.all(sqlQuery);
    // Proxy returns arrays, but we need objects - they'll be handled properly by Drizzle
    return result as Array<Record<string, unknown>>;
  }

  async getById(
    table: string,
    id: string | number,
    primaryKey: string,
    context?: { runtimeContext?: { get: (key: string) => unknown } },
  ): Promise<Record<string, unknown> | null> {
    // Validate table name
    if (!this.validateIdentifier(table)) {
      throw new Error(
        `Invalid table name: "${table}". Must match [A-Za-z_][A-Za-z0-9_]*`,
      );
    }

    // Validate primary key identifier
    if (!this.validateIdentifier(primaryKey)) {
      throw new Error(
        `Invalid primary key: "${primaryKey}". Must match [A-Za-z_][A-Za-z0-9_]*`,
      );
    }

    const db = this.getDb(context);
    const result = await db.get(
      this.buildSQL(
        `SELECT * FROM "${table}" WHERE "${primaryKey}" = ? LIMIT 1`,
        [id],
      ),
    );

    return result ? (result as Record<string, unknown>) : null;
  }

  async insert(
    table: string,
    data: Record<string, unknown>,
    context?: { runtimeContext?: { get: (key: string) => unknown } },
  ): Promise<Record<string, unknown>> {
    // Validate table name
    if (!this.validateIdentifier(table)) {
      throw new Error(
        `Invalid table name: "${table}". Must match [A-Za-z_][A-Za-z0-9_]*`,
      );
    }

    // Validate all column names against schema
    await this.validateDataColumns(table, data);

    const db = this.getDb(context);
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map(() => "?").join(", ");

    const query = `
      INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(", ")})
      VALUES (${placeholders})
    `;

    await db.run(this.buildSQL(query, values));

    // Get the inserted row
    const lastIdResult = await db.get<{ last_insert_rowid: number }>(
      sql`SELECT last_insert_rowid() as last_insert_rowid`,
    );

    if (lastIdResult) {
      // Find the primary key column
      const tableInfo = await db.all<{ name: string; pk: number }>(
        sql.raw(`PRAGMA table_info("${table}")`),
      );
      const pkColumn = tableInfo.find((col) => col.pk > 0);

      if (pkColumn) {
        const inserted = await db.get(
          this.buildSQL(
            `SELECT * FROM "${table}" WHERE "${pkColumn.name}" = ?`,
            [lastIdResult.last_insert_rowid],
          ),
        );
        return inserted as Record<string, unknown>;
      }
    }

    // Fallback: return the data with lastInsertRowid
    return { ...data, id: lastIdResult?.last_insert_rowid };
  }

  async update(
    table: string,
    id: string | number,
    primaryKey: string,
    data: Record<string, unknown>,
    context?: { runtimeContext?: { get: (key: string) => unknown } },
  ): Promise<Record<string, unknown>> {
    // Validate table name
    if (!this.validateIdentifier(table)) {
      throw new Error(
        `Invalid table name: "${table}". Must match [A-Za-z_][A-Za-z0-9_]*`,
      );
    }

    // Validate primary key identifier
    if (!this.validateIdentifier(primaryKey)) {
      throw new Error(
        `Invalid primary key: "${primaryKey}". Must match [A-Za-z_][A-Za-z0-9_]*`,
      );
    }

    // Validate all column names against schema
    await this.validateDataColumns(table, data);

    const db = this.getDb(context);
    const columns = Object.keys(data);
    const values = Object.values(data);
    const setClause = columns.map((col) => `"${col}" = ?`).join(", ");

    const query = `
      UPDATE "${table}"
      SET ${setClause}
      WHERE "${primaryKey}" = ?
    `;

    await db.run(this.buildSQL(query, [...values, id]));

    // Get the updated row
    const updated = await db.get(
      this.buildSQL(`SELECT * FROM "${table}" WHERE "${primaryKey}" = ?`, [id]),
    );

    if (!updated) {
      throw new Error("Update failed: could not retrieve updated row");
    }

    return updated as Record<string, unknown>;
  }

  async delete(
    table: string,
    id: string | number,
    primaryKey: string,
    context?: { runtimeContext?: { get: (key: string) => unknown } },
  ): Promise<boolean> {
    // Validate table name
    if (!this.validateIdentifier(table)) {
      throw new Error(
        `Invalid table name: "${table}". Must match [A-Za-z_][A-Za-z0-9_]*`,
      );
    }

    // Validate primary key identifier
    if (!this.validateIdentifier(primaryKey)) {
      throw new Error(
        `Invalid primary key: "${primaryKey}". Must match [A-Za-z_][A-Za-z0-9_]*`,
      );
    }

    const db = this.getDb(context);
    await db.run(
      this.buildSQL(`DELETE FROM "${table}" WHERE "${primaryKey}" = ?`, [id]),
    );

    const changes = await db.get<{ changes: number }>(
      sql`SELECT changes() as changes`,
    );

    return (changes?.changes ?? 0) > 0;
  }

  async close(): Promise<void> {
    // Drizzle proxy doesn't require explicit closing
    // Clear caches
    this.tableColumnsCache.clear();
    this.tableMetadataCache = null;
  }

  /**
   * Get valid column names for a table from database schema
   * Results are cached to avoid repeated queries
   */
  private async getTableColumns(table: string): Promise<Set<string>> {
    // Validate table name first
    if (!this.validateIdentifier(table)) {
      throw new Error(
        `Invalid table name: "${table}". Must match [A-Za-z_][A-Za-z0-9_]*`,
      );
    }

    // Check cache first
    if (this.tableColumnsCache.has(table)) {
      return this.tableColumnsCache.get(table)!;
    }

    // Query schema
    const db = this.getDb();
    const tableInfoRaw = await db.all(sql.raw(`PRAGMA table_info("${table}")`));

    if (!tableInfoRaw || tableInfoRaw.length === 0) {
      throw new Error(`Table "${table}" does not exist or has no columns`);
    }

    // Map arrays to objects: [cid, name, type, notnull, dflt_value, pk]
    const tableInfo = (tableInfoRaw as unknown[]).map((row: unknown) => ({
      name: Array.isArray(row) ? row[1] : (row as { name: string }).name,
    }));

    const columns = new Set(tableInfo.map((col) => col.name));
    this.tableColumnsCache.set(table, columns);
    return columns;
  }

  /**
   * Validates that all data keys are valid column names for the table
   * Throws error if any unknown columns are found
   */
  private async validateDataColumns(
    table: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const validColumns = await this.getTableColumns(table);
    const dataKeys = Object.keys(data);

    const invalidColumns = dataKeys.filter((key) => !validColumns.has(key));
    if (invalidColumns.length > 0) {
      throw new Error(
        `Invalid column names for table "${table}": ${invalidColumns.join(", ")}. Valid columns are: ${Array.from(validColumns).join(", ")}`,
      );
    }
  }

  /**
   * Validates a SQL identifier segment (column name, table name, etc.)
   * Must start with letter or underscore, followed by letters, numbers, or underscores
   */
  private validateIdentifier(segment: string): boolean {
    const identifierRegex = /^[A-Za-z_][A-Za-z0-9_]*$/;
    return identifierRegex.test(segment);
  }

  /**
   * Helper to build SQL query with inlined parameters for Drizzle proxy
   * Since sql.raw() doesn't accept separate parameters, we inline them safely
   */
  private buildSQL(
    queryString: string,
    params: unknown[],
  ): ReturnType<typeof sql.raw> {
    let result = queryString;
    for (const param of params) {
      const value =
        param === null || param === undefined
          ? "NULL"
          : typeof param === "string"
            ? `'${param.replace(/'/g, "''")}'`
            : typeof param === "number" || typeof param === "boolean"
              ? String(param)
              : `'${String(param).replace(/'/g, "''")}'`;
      result = result.replace("?", value);
    }
    return sql.raw(result);
  }

  /**
   * Validates and sanitizes ORDER BY field path
   * Returns properly quoted identifier or throws error
   */
  private sanitizeOrderByField(fieldSegments: string[]): string {
    if (!fieldSegments || fieldSegments.length === 0) {
      throw new Error("ORDER BY field cannot be empty");
    }

    // Validate each segment
    for (const segment of fieldSegments) {
      if (!this.validateIdentifier(segment)) {
        throw new Error(
          `Invalid ORDER BY field segment: "${segment}". Must match [A-Za-z_][A-Za-z0-9_]*`,
        );
      }
    }

    // Quote each segment separately and join with "."
    return fieldSegments.map((segment) => `"${segment}"`).join(".");
  }

  /**
   * Validates ORDER BY direction
   * Returns uppercase "ASC" or "DESC" or throws error
   */
  private sanitizeOrderByDirection(direction: string): "ASC" | "DESC" {
    const normalized = direction.toUpperCase();
    if (normalized !== "ASC" && normalized !== "DESC") {
      throw new Error(
        `Invalid ORDER BY direction: "${direction}". Must be "asc" or "desc"`,
      );
    }
    return normalized as "ASC" | "DESC";
  }

  /**
   * Build WHERE clause from WhereExpression
   */
  private buildWhereClause(
    where: WhereExpression,
    params: unknown[],
    startIndex: number,
  ): { clause: string; nextIndex: number } {
    let paramIndex = startIndex;

    // Check if it's a comparison expression
    if ("field" in where && "operator" in where && "value" in where) {
      const field = this.sanitizeOrderByField(where.field);
      const operator = where.operator;
      const value = where.value;

      switch (operator) {
        case "eq":
          params.push(value);
          return {
            clause: `${field} = ?`,
            nextIndex: paramIndex + 1,
          };
        case "gt":
          params.push(value);
          return {
            clause: `${field} > ?`,
            nextIndex: paramIndex + 1,
          };
        case "gte":
          params.push(value);
          return {
            clause: `${field} >= ?`,
            nextIndex: paramIndex + 1,
          };
        case "lt":
          params.push(value);
          return {
            clause: `${field} < ?`,
            nextIndex: paramIndex + 1,
          };
        case "lte":
          params.push(value);
          return {
            clause: `${field} <= ?`,
            nextIndex: paramIndex + 1,
          };
        case "in":
          if (Array.isArray(value)) {
            const placeholders = value.map(() => "?").join(", ");
            params.push(...value);
            return {
              clause: `${field} IN (${placeholders})`,
              nextIndex: paramIndex + value.length,
            };
          }
          return { clause: "", nextIndex: paramIndex };
        case "like":
          params.push(value);
          return {
            clause: `${field} LIKE ?`,
            nextIndex: paramIndex + 1,
          };
        case "contains":
          params.push(`%${value}%`);
          return {
            clause: `${field} LIKE ?`,
            nextIndex: paramIndex + 1,
          };
        default:
          return { clause: "", nextIndex: paramIndex };
      }
    }

    // Logical operators (and, or, not)
    if ("operator" in where && "conditions" in where) {
      const conditions: string[] = [];
      let currentIndex = paramIndex;

      for (const condition of where.conditions) {
        const result = this.buildWhereClause(condition, params, currentIndex);
        if (result.clause) {
          conditions.push(result.clause);
          currentIndex = result.nextIndex;
        }
      }

      if (conditions.length === 0) {
        return { clause: "", nextIndex: currentIndex };
      }

      const operator = where.operator.toUpperCase();
      if (operator === "NOT") {
        return {
          clause: `NOT (${conditions.join(" AND ")})`,
          nextIndex: currentIndex,
        };
      }

      return {
        clause: `(${conditions.join(` ${operator} `)})`,
        nextIndex: currentIndex,
      };
    }

    return { clause: "", nextIndex: paramIndex };
  }
}

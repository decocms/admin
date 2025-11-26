/**
 * SQLite Database Adapter Implementation
 *
 * Implements CRUD operations using the `better-sqlite3` package.
 */

import Database from "better-sqlite3";
import type {
  DatabaseAdapter,
  QueryParams,
  TableMetadata,
  SqliteConfig,
} from "../types";
import type { WhereExpression } from "@decocms/bindings/collections";
import { SqliteIntrospector } from "../introspection/sqlite";

/**
 * SQLite adapter for collection operations
 */
export class SqliteAdapter implements DatabaseAdapter {
  private db: Database.Database;
  private introspector: SqliteIntrospector;
  private tableColumnsCache: Map<string, Set<string>> = new Map();

  constructor(config: SqliteConfig) {
    this.db = new Database(config.filename);
    this.introspector = new SqliteIntrospector(config.filename);
  }

  async introspect(): Promise<TableMetadata[]> {
    return this.introspector.introspect();
  }

  async query(
    table: string,
    params: QueryParams,
  ): Promise<Array<Record<string, unknown>>> {
    // Validate table name
    if (!this.validateIdentifier(table)) {
      throw new Error(
        `Invalid table name: "${table}". Must match [A-Za-z_][A-Za-z0-9_]*`,
      );
    }

    const { where, orderBy, limit, offset } = params;

    // Build query dynamically
    let query = `SELECT * FROM "${table}"`;
    const queryParams: unknown[] = [];

    // Add WHERE clause if provided
    if (where) {
      const whereClause = this.buildWhereClause(
        where as WhereExpression,
        queryParams,
      );
      if (whereClause) {
        query += ` WHERE ${whereClause}`;
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

    const stmt = this.db.prepare(query);
    const result = stmt.all(...queryParams);
    return result as Array<Record<string, unknown>>;
  }

  async getById(
    table: string,
    id: string | number,
    primaryKey: string,
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

    const stmt = this.db.prepare(
      `SELECT * FROM "${table}" WHERE "${primaryKey}" = ? LIMIT 1`,
    );
    const result = stmt.get(id);
    return result ? (result as Record<string, unknown>) : null;
  }

  async insert(
    table: string,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    // Validate table name
    if (!this.validateIdentifier(table)) {
      throw new Error(
        `Invalid table name: "${table}". Must match [A-Za-z_][A-Za-z0-9_]*`,
      );
    }

    // Validate all column names against schema
    this.validateDataColumns(table, data);

    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map(() => "?").join(", ");

    const query = `
      INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(", ")})
      VALUES (${placeholders})
    `;

    const stmt = this.db.prepare(query);
    const result = stmt.run(...values);

    // Get the inserted row
    if (result.lastInsertRowid) {
      // Find the primary key column
      const tableInfo = this.db
        .prepare(`PRAGMA table_info("${table}")`)
        .all() as Array<{ name: string; pk: number }>;
      const pkColumn = tableInfo.find((col) => col.pk > 0);

      if (pkColumn) {
        const selectStmt = this.db.prepare(
          `SELECT * FROM "${table}" WHERE "${pkColumn.name}" = ?`,
        );
        const inserted = selectStmt.get(result.lastInsertRowid);
        return inserted as Record<string, unknown>;
      }
    }

    // Fallback: return the data with lastInsertRowid
    return { ...data, id: result.lastInsertRowid };
  }

  async update(
    table: string,
    id: string | number,
    primaryKey: string,
    data: Record<string, unknown>,
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
    this.validateDataColumns(table, data);

    const columns = Object.keys(data);
    const values = Object.values(data);
    const setClause = columns.map((col) => `"${col}" = ?`).join(", ");

    const query = `
      UPDATE "${table}"
      SET ${setClause}
      WHERE "${primaryKey}" = ?
    `;

    const stmt = this.db.prepare(query);
    const result = stmt.run(...values, id);

    if (result.changes === 0) {
      throw new Error("Update failed: no rows affected");
    }

    // Get the updated row
    const selectStmt = this.db.prepare(
      `SELECT * FROM "${table}" WHERE "${primaryKey}" = ?`,
    );
    const updated = selectStmt.get(id);

    if (!updated) {
      throw new Error("Update failed: could not retrieve updated row");
    }

    return updated as Record<string, unknown>;
  }

  async delete(
    table: string,
    id: string | number,
    primaryKey: string,
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

    const stmt = this.db.prepare(
      `DELETE FROM "${table}" WHERE "${primaryKey}" = ?`,
    );
    const result = stmt.run(id);
    return result.changes > 0;
  }

  async close(): Promise<void> {
    this.db.close();
    await this.introspector.close();
  }

  /**
   * Get valid column names for a table from database schema
   * Results are cached to avoid repeated queries
   */
  private getTableColumns(table: string): Set<string> {
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
    const tableInfo = this.db
      .prepare(`PRAGMA table_info("${table}")`)
      .all() as Array<{ name: string }>;

    if (tableInfo.length === 0) {
      throw new Error(`Table "${table}" does not exist or has no columns`);
    }

    const columns = new Set(tableInfo.map((col) => col.name));
    this.tableColumnsCache.set(table, columns);
    return columns;
  }

  /**
   * Validates that all data keys are valid column names for the table
   * Throws error if any unknown columns are found
   */
  private validateDataColumns(
    table: string,
    data: Record<string, unknown>,
  ): void {
    const validColumns = this.getTableColumns(table);
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
  private buildWhereClause(where: WhereExpression, params: unknown[]): string {
    // Check if it's a comparison expression
    if ("field" in where && "operator" in where && "value" in where) {
      const field = this.sanitizeOrderByField(where.field);
      const operator = where.operator;
      const value = where.value;

      switch (operator) {
        case "eq":
          params.push(value);
          return `${field} = ?`;
        case "gt":
          params.push(value);
          return `${field} > ?`;
        case "gte":
          params.push(value);
          return `${field} >= ?`;
        case "lt":
          params.push(value);
          return `${field} < ?`;
        case "lte":
          params.push(value);
          return `${field} <= ?`;
        case "in":
          if (Array.isArray(value)) {
            const placeholders = value.map(() => "?").join(", ");
            params.push(...value);
            return `${field} IN (${placeholders})`;
          }
          return "";
        case "like":
          params.push(value);
          return `${field} LIKE ?`;
        case "contains":
          params.push(`%${value}%`);
          return `${field} LIKE ?`;
        default:
          return "";
      }
    }

    // Logical operators (and, or, not)
    if ("operator" in where && "conditions" in where) {
      const conditions: string[] = [];

      for (const condition of where.conditions) {
        const clause = this.buildWhereClause(condition, params);
        if (clause) {
          conditions.push(clause);
        }
      }

      if (conditions.length === 0) {
        return "";
      }

      const operator = where.operator.toUpperCase();
      if (operator === "NOT") {
        return `NOT (${conditions.join(" AND ")})`;
      }

      return `(${conditions.join(` ${operator} `)})`;
    }

    return "";
  }
}

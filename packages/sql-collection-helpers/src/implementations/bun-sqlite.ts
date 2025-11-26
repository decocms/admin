/**
 * Bun SQLite Database Adapter Implementation
 *
 * Implements CRUD operations using Bun's native SQLite (bun:sqlite).
 * This is used for testing in Bun runtime.
 */

import { Database } from "bun:sqlite";
import type {
  DatabaseAdapter,
  QueryParams,
  TableMetadata,
  SqliteConfig,
} from "../types";
import type { WhereExpression } from "@decocms/bindings/collections";
import { SqliteIntrospectorBun } from "../introspection/bun-sqlite";

/**
 * Bun SQLite adapter for collection operations
 */
export class BunSqliteAdapter implements DatabaseAdapter {
  private db: Database;
  private introspector: SqliteIntrospectorBun;

  constructor(config: SqliteConfig) {
    this.db = new Database(config.filename);
    this.introspector = new SqliteIntrospectorBun(config.filename);
  }

  async introspect(): Promise<TableMetadata[]> {
    return this.introspector.introspect();
  }

  async query(
    table: string,
    params: QueryParams,
  ): Promise<Array<Record<string, unknown>>> {
    const { where, orderBy, limit, offset } = params;

    // Build query dynamically
    let query = `SELECT * FROM "${table}"`;
    const queryParams: unknown[] = [];

    // Add WHERE clause if provided
    if (where) {
      const whereClause = this.buildWhereClause(where as WhereExpression, queryParams);
      if (whereClause) {
        query += ` WHERE ${whereClause}`;
      }
    }

    // Add ORDER BY clause
    if (orderBy && orderBy.length > 0) {
      const orderClauses = orderBy.map((order) => {
        const field = order.field.join(".");
        return `"${field}" ${order.direction.toUpperCase()}`;
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
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map(() => "?").join(", ");

    const query = `
      INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(", ")})
      VALUES (${placeholders})
    `;

    const stmt = this.db.prepare(query);
    stmt.run(...values);

    // Get the inserted row
    const lastInsertRowid = this.db.query("SELECT last_insert_rowid() as id").get() as { id: number };
    
    if (lastInsertRowid) {
      // Find the primary key column
      const tableInfo = this.db
        .prepare(`PRAGMA table_info("${table}")`)
        .all() as Array<{ name: string; pk: number }>;
      const pkColumn = tableInfo.find((col) => col.pk > 0);

      if (pkColumn) {
        const selectStmt = this.db.prepare(
          `SELECT * FROM "${table}" WHERE "${pkColumn.name}" = ?`,
        );
        const inserted = selectStmt.get(lastInsertRowid.id);
        return inserted as Record<string, unknown>;
      }
    }

    // Fallback: return the data with lastInsertRowid
    return { ...data, id: lastInsertRowid.id };
  }

  async update(
    table: string,
    id: string | number,
    primaryKey: string,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const setClause = columns.map((col) => `"${col}" = ?`).join(", ");

    const query = `
      UPDATE "${table}"
      SET ${setClause}
      WHERE "${primaryKey}" = ?
    `;

    const stmt = this.db.prepare(query);
    stmt.run(...values, id);

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
    const stmt = this.db.prepare(
      `DELETE FROM "${table}" WHERE "${primaryKey}" = ?`,
    );
    stmt.run(id);
    return (this.db.query("SELECT changes() as changes").get() as { changes: number }).changes > 0;
  }

  async close(): Promise<void> {
    this.db.close();
    await this.introspector.close();
  }

  /**
   * Build WHERE clause from WhereExpression
   */
  private buildWhereClause(
    where: WhereExpression,
    params: unknown[],
  ): string {
    // Check if it's a comparison expression
    if ("field" in where && "operator" in where && "value" in where) {
      const field = where.field.join(".");
      const operator = where.operator;
      const value = where.value;

      switch (operator) {
        case "eq":
          params.push(value);
          return `"${field}" = ?`;
        case "gt":
          params.push(value);
          return `"${field}" > ?`;
        case "gte":
          params.push(value);
          return `"${field}" >= ?`;
        case "lt":
          params.push(value);
          return `"${field}" < ?`;
        case "lte":
          params.push(value);
          return `"${field}" <= ?`;
        case "in":
          if (Array.isArray(value)) {
            const placeholders = value.map(() => "?").join(", ");
            params.push(...value);
            return `"${field}" IN (${placeholders})`;
          }
          return "";
        case "like":
          params.push(value);
          return `"${field}" LIKE ?`;
        case "contains":
          params.push(`%${value}%`);
          return `"${field}" LIKE ?`;
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


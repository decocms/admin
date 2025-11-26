/**
 * PostgreSQL Database Adapter Implementation
 *
 * Implements CRUD operations using the `postgres` package with parameterized queries.
 */

import postgres from "postgres";
import type {
  DatabaseAdapter,
  QueryParams,
  TableMetadata,
  PostgresConfig,
} from "../types";
import type { WhereExpression } from "@decocms/bindings/collections";
import { PostgresIntrospector } from "../introspection/postgres";

/**
 * PostgreSQL adapter for collection operations
 */
export class PostgresAdapter implements DatabaseAdapter {
  private sql: ReturnType<typeof postgres>;
  private introspector: PostgresIntrospector;
  private schema: string;
  private tableColumnsCache: Map<string, Set<string>> = new Map();

  constructor(config: PostgresConfig) {
    this.sql = postgres(config.connectionString);
    this.schema = config.schema ?? "public";
    this.introspector = new PostgresIntrospector(
      config.connectionString,
      this.schema,
    );
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
    let query = `SELECT * FROM "${this.schema}"."${table}"`;
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
      query += ` LIMIT $${paramIndex++}`;
      queryParams.push(limit);
    }
    if (offset !== undefined) {
      query += ` OFFSET $${paramIndex++}`;
      queryParams.push(offset);
    }

    const result = await this.sql.unsafe(query, queryParams as never[]);
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

    const result = await this.sql`
      SELECT *
      FROM ${this.sql(this.schema)}.${this.sql(table)}
      WHERE ${this.sql(primaryKey)} = ${id}
      LIMIT 1
    `;

    return result.length > 0 ? (result[0] as Record<string, unknown>) : null;
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
    await this.validateDataColumns(table, data);

    const result = await this.sql`
      INSERT INTO ${this.sql(this.schema)}.${this.sql(table)}
      ${this.sql(data)}
      RETURNING *
    `;

    if (result.length === 0) {
      throw new Error("Insert failed: no rows returned");
    }

    return result[0] as Record<string, unknown>;
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
    await this.validateDataColumns(table, data);

    const result = await this.sql`
      UPDATE ${this.sql(this.schema)}.${this.sql(table)}
      SET ${this.sql(data)}
      WHERE ${this.sql(primaryKey)} = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      throw new Error("Update failed: no rows affected");
    }

    return result[0] as Record<string, unknown>;
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

    const result = await this.sql`
      DELETE FROM ${this.sql(this.schema)}.${this.sql(table)}
      WHERE ${this.sql(primaryKey)} = ${id}
    `;

    return result.count > 0;
  }

  async close(): Promise<void> {
    await this.sql.end();
    await this.introspector.close();
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
    const cacheKey = `${this.schema}.${table}`;
    if (this.tableColumnsCache.has(cacheKey)) {
      return this.tableColumnsCache.get(cacheKey)!;
    }

    // Query schema
    const result = await this.sql<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = ${this.schema}
        AND table_name = ${table}
    `;

    if (result.length === 0) {
      throw new Error(
        `Table "${this.schema}"."${table}" does not exist or has no columns`,
      );
    }

    const columns = new Set(result.map((col) => col.column_name));
    this.tableColumnsCache.set(cacheKey, columns);
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
            clause: `${field} = $${paramIndex}`,
            nextIndex: paramIndex + 1,
          };
        case "gt":
          params.push(value);
          return {
            clause: `${field} > $${paramIndex}`,
            nextIndex: paramIndex + 1,
          };
        case "gte":
          params.push(value);
          return {
            clause: `${field} >= $${paramIndex}`,
            nextIndex: paramIndex + 1,
          };
        case "lt":
          params.push(value);
          return {
            clause: `${field} < $${paramIndex}`,
            nextIndex: paramIndex + 1,
          };
        case "lte":
          params.push(value);
          return {
            clause: `${field} <= $${paramIndex}`,
            nextIndex: paramIndex + 1,
          };
        case "in":
          if (Array.isArray(value)) {
            params.push(value);
            return {
              clause: `${field} = ANY($${paramIndex})`,
              nextIndex: paramIndex + 1,
            };
          }
          return { clause: "", nextIndex: paramIndex };
        case "like":
          params.push(value);
          return {
            clause: `${field} LIKE $${paramIndex}`,
            nextIndex: paramIndex + 1,
          };
        case "contains":
          params.push(`%${value}%`);
          return {
            clause: `${field} LIKE $${paramIndex}`,
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

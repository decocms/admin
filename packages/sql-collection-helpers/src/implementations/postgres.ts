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
        const field = order.field.join(".");
        return `"${field}" ${order.direction.toUpperCase()}`;
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
      const field = where.field.join(".");
      const operator = where.operator;
      const value = where.value;

      switch (operator) {
        case "eq":
          params.push(value);
          return {
            clause: `"${field}" = $${paramIndex}`,
            nextIndex: paramIndex + 1,
          };
        case "gt":
          params.push(value);
          return {
            clause: `"${field}" > $${paramIndex}`,
            nextIndex: paramIndex + 1,
          };
        case "gte":
          params.push(value);
          return {
            clause: `"${field}" >= $${paramIndex}`,
            nextIndex: paramIndex + 1,
          };
        case "lt":
          params.push(value);
          return {
            clause: `"${field}" < $${paramIndex}`,
            nextIndex: paramIndex + 1,
          };
        case "lte":
          params.push(value);
          return {
            clause: `"${field}" <= $${paramIndex}`,
            nextIndex: paramIndex + 1,
          };
        case "in":
          if (Array.isArray(value)) {
            params.push(value);
            return {
              clause: `"${field}" = ANY($${paramIndex})`,
              nextIndex: paramIndex + 1,
            };
          }
          return { clause: "", nextIndex: paramIndex };
        case "like":
          params.push(value);
          return {
            clause: `"${field}" LIKE $${paramIndex}`,
            nextIndex: paramIndex + 1,
          };
        case "contains":
          params.push(`%${value}%`);
          return {
            clause: `"${field}" LIKE $${paramIndex}`,
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

/**
 * PostgreSQL Database Introspection
 *
 * Uses the `postgres` package to introspect PostgreSQL database schema
 * via information_schema queries.
 */

import postgres from "postgres";
import type { ColumnMetadata, TableMetadata } from "../types";
import { detectAuditFields, normalizeSqlType } from "../schema-generator";
import type { DatabaseIntrospector } from "./types";

interface PgColumn {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  is_identity: string;
}

interface PgConstraint {
  table_name: string;
  column_name: string;
  constraint_type: string;
}

/**
 * PostgreSQL introspector implementation
 */
export class PostgresIntrospector implements DatabaseIntrospector {
  private sql: ReturnType<typeof postgres>;
  private schema: string;

  constructor(connectionString: string, schema = "public") {
    this.sql = postgres(connectionString);
    this.schema = schema;
  }

  async introspect(): Promise<TableMetadata[]> {
    try {
      // Get all tables in the schema
      const tables = await this.sql<Array<{ table_name: string }>>`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = ${this.schema}
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `;

      const tableMetadata: TableMetadata[] = [];

      for (const { table_name } of tables) {
        const columns = await this.getColumns(table_name);
        const primaryKey = await this.getPrimaryKey(table_name);
        const auditFields = detectAuditFields(columns);

        tableMetadata.push({
          name: table_name,
          schema: this.schema,
          columns,
          primaryKey,
          auditFields,
        });
      }

      return tableMetadata;
    } catch (error) {
      console.error("PostgreSQL introspection failed:", error);
      throw error;
    }
  }

  private async getColumns(tableName: string): Promise<ColumnMetadata[]> {
    // Get column information
    const columns = await this.sql<PgColumn[]>`
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default,
        is_identity
      FROM information_schema.columns
      WHERE table_schema = ${this.schema}
        AND table_name = ${tableName}
      ORDER BY ordinal_position
    `;

    // Get primary key constraints
    const constraints = await this.sql<PgConstraint[]>`
      SELECT 
        tc.table_name,
        kcu.column_name,
        tc.constraint_type
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = ${this.schema}
        AND tc.table_name = ${tableName}
        AND tc.constraint_type = 'PRIMARY KEY'
    `;

    const primaryKeyColumns = new Set(constraints.map((c) => c.column_name));

    return columns.map((col) => {
      const isPrimaryKey = primaryKeyColumns.has(col.column_name);
      const isAutoIncrement =
        col.is_identity === "YES" ||
        (col.column_default?.includes("nextval") ?? false);

      return {
        name: col.column_name,
        type: normalizeSqlType(col.data_type),
        rawType: col.data_type,
        nullable: col.is_nullable === "YES",
        isPrimaryKey,
        hasDefault: col.column_default !== null,
        defaultValue: col.column_default ?? undefined,
        isAutoIncrement,
      };
    });
  }

  private async getPrimaryKey(tableName: string): Promise<string | null> {
    const constraints = await this.sql<PgConstraint[]>`
      SELECT 
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = ${this.schema}
        AND tc.table_name = ${tableName}
        AND tc.constraint_type = 'PRIMARY KEY'
      ORDER BY kcu.ordinal_position
      LIMIT 1
    `;

    if (constraints.length > 0) {
      return constraints[0].column_name;
    }

    return null;
  }

  async close(): Promise<void> {
    await this.sql.end();
  }
}

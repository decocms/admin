/**
 * Bun SQLite Database Introspection
 *
 * Uses Bun's native SQLite (bun:sqlite) to introspect database schema.
 * This is used for testing in Bun runtime.
 */

// @ts-ignore - bun:sqlite only available in Bun runtime
import { Database } from "bun:sqlite";
import type { ColumnMetadata, TableMetadata } from "../types";
import { detectAuditFields, normalizeSqlType } from "../schema-generator";
import type { DatabaseIntrospector } from "./types";

interface SqliteMasterRow {
  type: string;
  name: string;
  tbl_name: string;
  sql: string;
}

interface PragmaTableInfoRow {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

/**
 * Bun SQLite introspector implementation
 */
export class SqliteIntrospectorBun implements DatabaseIntrospector {
  private db: Database;

  constructor(filename: string) {
    this.db = new Database(filename);
  }

  async introspect(): Promise<TableMetadata[]> {
    try {
      // Get all tables from sqlite_master
      const tables = this.db
        .prepare(
          `
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
          AND name NOT LIKE 'mastra_%'
        ORDER BY name
      `,
        )
        .all() as Array<{ name: string }>;

      const tableMetadata: TableMetadata[] = [];

      for (const { name } of tables) {
        const columns = this.getColumns(name);
        const primaryKey = this.getPrimaryKey(columns);
        const auditFields = detectAuditFields(columns);

        tableMetadata.push({
          name,
          columns,
          primaryKey,
          auditFields,
        });
      }

      return tableMetadata;
    } catch (error) {
      console.error("Bun SQLite introspection failed:", error);
      throw error;
    }
  }

  private getColumns(tableName: string): ColumnMetadata[] {
    // Use PRAGMA table_info to get column information
    const columns = this.db
      .prepare(`PRAGMA table_info(${tableName})`)
      .all() as PragmaTableInfoRow[];

    return columns.map((col) => {
      const isPrimaryKey = col.pk > 0;
      const isAutoIncrement = isPrimaryKey && this.isAutoIncrement(tableName);

      return {
        name: col.name,
        type: normalizeSqlType(col.type || "TEXT"),
        rawType: col.type || "TEXT",
        nullable: col.notnull === 0,
        isPrimaryKey,
        hasDefault: col.dflt_value !== null,
        defaultValue: col.dflt_value ?? undefined,
        isAutoIncrement,
      };
    });
  }

  private getPrimaryKey(columns: ColumnMetadata[]): string | null {
    const pkColumn = columns.find((col) => col.isPrimaryKey);
    return pkColumn ? pkColumn.name : null;
  }

  private isAutoIncrement(tableName: string): boolean {
    // Check if the table has AUTOINCREMENT in its CREATE TABLE statement
    const result = this.db
      .prepare(
        `
      SELECT sql
      FROM sqlite_master
      WHERE type = 'table' AND name = ?
    `,
      )
      .get(tableName) as SqliteMasterRow | undefined;

    if (result?.sql) {
      return result.sql.toUpperCase().includes("AUTOINCREMENT");
    }

    return false;
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

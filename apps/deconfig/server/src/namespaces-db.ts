/**
 * Database CRUD operations for DECONFIG namespaces.
 * Simple, straightforward database operations without complex validation.
 */
import type { Env } from "../main.ts";

export interface NamespaceRecord {
  name: string;
  created_at: number;
  metadata: Record<string, any>;
  origin_namespace: string | null;
}

export interface CreateNamespaceInput {
  name: string;
  metadata?: Record<string, any>;
  origin_namespace?: string;
}

export interface ListNamespacesInput {
  prefix?: string;
}

export function newNamespacesCRUD(env: Env) {
  // Initialize table on first use
  const initTable = async () => {
    await env.DECO_CHAT_WORKSPACE_DB.query({
      sql: `CREATE TABLE IF NOT EXISTS DECONFIG_NAMESPACES (
        name TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}',
        origin_namespace TEXT
      )`,
      params: [],
    });

    await env.DECO_CHAT_WORKSPACE_DB.query({
      sql: `CREATE INDEX IF NOT EXISTS idx_namespaces_created_at 
            ON DECONFIG_NAMESPACES (created_at)`,
      params: [],
    });
  };

  return {
    async createNamespace(input: CreateNamespaceInput): Promise<NamespaceRecord> {
      await initTable();

      const now = Date.now();
      const metadata = JSON.stringify(input.metadata || {});

      await env.DECO_CHAT_WORKSPACE_DB.query({
        sql: `INSERT INTO DECONFIG_NAMESPACES 
              (name, created_at, metadata, origin_namespace) 
              VALUES (?, ?, ?, ?)`,
        params: [input.name, now.toString(), metadata, input.origin_namespace || ""],
      });

      return {
        name: input.name,
        created_at: now,
        metadata: input.metadata || {},
        origin_namespace: input.origin_namespace || null,
      };
    },

    async deleteNamespace(name: string): Promise<boolean> {
      await initTable();

      const result = await env.DECO_CHAT_WORKSPACE_DB.query({
        sql: `DELETE FROM DECONFIG_NAMESPACES WHERE name = ?`,
        params: [name],
      });

      return (result.result[0]?.meta?.changes || 0) > 0;
    },

    async listNamespaces(input: ListNamespacesInput = {}): Promise<NamespaceRecord[]> {
      await initTable();

      let sql = `SELECT name, created_at, metadata, origin_namespace 
                 FROM DECONFIG_NAMESPACES`;
      const params: string[] = [];

      if (input.prefix) {
        sql += ` WHERE name LIKE ?`;
        params.push(`${input.prefix}%`);
      }

      sql += ` ORDER BY created_at DESC`;

      const result = await env.DECO_CHAT_WORKSPACE_DB.query({
        sql,
        params,
      });

      const rows = result.result[0]?.results || [];
      return rows.map((row: any) => ({
        name: row[0],
        created_at: parseInt(row[1]),
        metadata: JSON.parse(row[2] || "{}"),
        origin_namespace: row[3] || null,
      }));
    },

    async getNamespace(name: string): Promise<NamespaceRecord | null> {
      await initTable();

      const result = await env.DECO_CHAT_WORKSPACE_DB.query({
        sql: `SELECT name, created_at, metadata, origin_namespace 
              FROM DECONFIG_NAMESPACES 
              WHERE name = ?`,
        params: [name],
      });

      const rows = result.result[0]?.results || [];
      if (rows.length === 0) return null;

      const row = rows[0] as any;
      return {
        name: row[0],
        created_at: parseInt(row[1]),
        metadata: JSON.parse(row[2] || "{}"),
        origin_namespace: row[3] || null,
      };
    },

    async namespaceExists(name: string): Promise<boolean> {
      const namespace = await this.getNamespace(name);
      return namespace !== null;
    },
  };
}
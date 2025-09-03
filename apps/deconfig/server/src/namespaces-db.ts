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
    async createNamespace(
      input: CreateNamespaceInput,
    ): Promise<NamespaceRecord> {
      await initTable();

      const now = Date.now();
      const metadata = JSON.stringify(input.metadata || {});

      await env.DECO_CHAT_WORKSPACE_DB.query({
        sql: `INSERT INTO DECONFIG_NAMESPACES 
              (name, created_at, metadata, origin_namespace) 
              VALUES (?, ?, ?, ?)`,
        params: [
          input.name,
          now.toString(),
          metadata,
          input.origin_namespace || "NULL",
        ],
      });

      return {
        name: input.name,
        created_at: now,
        metadata: input.metadata || {},
        origin_namespace: input.origin_namespace || null,
      };
    },

    async deleteNamespace(namespaceName: string): Promise<boolean> {
      await initTable();

      const result = await env.DECO_CHAT_WORKSPACE_DB.query({
        sql: `DELETE FROM DECONFIG_NAMESPACES WHERE name = ?`,
        params: [namespaceName],
      });

      return (result.result[0]?.meta?.changes || 0) > 0;
    },

    async listNamespaces(
      input: ListNamespacesInput = {},
    ): Promise<NamespaceRecord[]> {
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

      // Handle different possible result structures
      let rows: any[] = [];

      if (result.result && result.result.length > 0) {
        const firstResult = result.result[0];
        if (firstResult?.results && Array.isArray(firstResult.results)) {
          rows = firstResult.results;
        } else if (Array.isArray(firstResult)) {
          rows = firstResult;
        }
      }

      // If still empty, try the result directly
      if (
        rows.length === 0 &&
        (result as any).results &&
        Array.isArray((result as any).results)
      ) {
        rows = (result as any).results;
      }

      return rows.map((row: any) => {
        // Handle both array and object formats
        const nameValue = Array.isArray(row) ? row[0] : row.name;
        const createdAtValue = Array.isArray(row) ? row[1] : row.created_at;
        const metadataValue = Array.isArray(row) ? row[2] : row.metadata;
        const originNamespaceValue = Array.isArray(row)
          ? row[3]
          : row.origin_namespace;

        return {
          name: nameValue,
          created_at: parseInt(createdAtValue || 0),
          metadata: JSON.parse(metadataValue || "{}"),
          origin_namespace:
            originNamespaceValue === "NULL" || !originNamespaceValue
              ? null
              : originNamespaceValue,
        };
      });
    },

    async getNamespace(namespaceName: string): Promise<NamespaceRecord | null> {
      await initTable();

      const result = await env.DECO_CHAT_WORKSPACE_DB.query({
        sql: `SELECT name, created_at, metadata, origin_namespace 
              FROM DECONFIG_NAMESPACES 
              WHERE name = ?`,
        params: [namespaceName],
      });

      // Handle different possible result structures
      let rows: any[] = [];

      if (result.result && result.result.length > 0) {
        const firstResult = result.result[0];
        if (firstResult?.results && Array.isArray(firstResult.results)) {
          rows = firstResult.results;
        } else if (Array.isArray(firstResult)) {
          rows = firstResult;
        }
      }

      if (rows.length === 0) return null;

      const row = rows[0] as any;
      // Handle both array and object formats
      const nameValue = Array.isArray(row) ? row[0] : row.name;
      const createdAtValue = Array.isArray(row) ? row[1] : row.created_at;
      const metadataValue = Array.isArray(row) ? row[2] : row.metadata;
      const originNamespaceValue = Array.isArray(row)
        ? row[3]
        : row.origin_namespace;

      return {
        name: nameValue,
        created_at: parseInt(createdAtValue || 0),
        metadata: JSON.parse(metadataValue || "{}"),
        origin_namespace:
          originNamespaceValue === "NULL" || !originNamespaceValue
            ? null
            : originNamespaceValue,
      };
    },

    async namespaceExists(namespaceName: string): Promise<boolean> {
      const namespace = await this.getNamespace(namespaceName);
      return namespace !== null;
    },
  };
}

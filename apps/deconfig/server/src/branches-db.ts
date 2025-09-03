/**
 * Database CRUD operations for DECONFIG branches.
 * Simple, straightforward database operations without complex validation.
 */
import type { Env } from "../main.ts";

export interface BranchRecord {
  name: string;
  created_at: number;
  metadata: Record<string, any>;
  origin_branch: string | null;
}

export interface CreateBranchInput {
  name: string;
  metadata?: Record<string, any>;
  origin_branch?: string | null;
}

export interface ListBranchesInput {
  prefix?: string;
}

export function newBranchesCRUD(env: Env) {
  // Initialize table on first use
  const initTable = async () => {
    await env.DECO_CHAT_WORKSPACE_DB.query({
      sql: `CREATE TABLE IF NOT EXISTS DECONFIG_BRANCHES (
        name TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}',
        origin_branch TEXT
      )`,
      params: [],
    });

    await env.DECO_CHAT_WORKSPACE_DB.query({
      sql: `CREATE INDEX IF NOT EXISTS idx_branches_created_at 
            ON DECONFIG_BRANCHES (created_at)`,
      params: [],
    });
  };

  return {
    async createBranch(input: CreateBranchInput): Promise<BranchRecord> {
      await initTable();

      const now = Date.now();
      const metadata = JSON.stringify(input.metadata || {});

      await env.DECO_CHAT_WORKSPACE_DB.query({
        sql: `INSERT INTO DECONFIG_BRANCHES 
              (name, created_at, metadata, origin_branch) 
              VALUES (?, ?, ?, ?)`,
        params: [
          input.name,
          now.toString(),
          metadata,
          input.origin_branch || "NULL",
        ],
      });

      return {
        name: input.name,
        created_at: now,
        metadata: input.metadata || {},
        origin_branch: input.origin_branch || null,
      };
    },

    async deleteBranch(branchName: string): Promise<boolean> {
      await initTable();

      const result = await env.DECO_CHAT_WORKSPACE_DB.query({
        sql: `DELETE FROM DECONFIG_BRANCHES WHERE name = ?`,
        params: [branchName],
      });

      return (result.result[0]?.meta?.changes || 0) > 0;
    },

    async listBranches(input: ListBranchesInput = {}): Promise<BranchRecord[]> {
      await initTable();

      let sql = `SELECT name, created_at, metadata, origin_branch 
                 FROM DECONFIG_BRANCHES`;
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
        const originBranchValue = Array.isArray(row)
          ? row[3]
          : row.origin_branch;

        return {
          name: nameValue,
          created_at: parseInt(createdAtValue || 0),
          metadata: JSON.parse(metadataValue || "{}"),
          origin_branch:
            originBranchValue === "NULL" || !originBranchValue
              ? null
              : originBranchValue,
        };
      });
    },

    async getBranch(branchName: string): Promise<BranchRecord | null> {
      await initTable();

      const result = await env.DECO_CHAT_WORKSPACE_DB.query({
        sql: `SELECT name, created_at, metadata, origin_branch 
              FROM DECONFIG_BRANCHES 
              WHERE name = ?`,
        params: [branchName],
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

      if (rows.length === 0) {
        return null;
      }

      const row = rows[0];
      const nameValue = Array.isArray(row) ? row[0] : row.name;
      const createdAtValue = Array.isArray(row) ? row[1] : row.created_at;
      const metadataValue = Array.isArray(row) ? row[2] : row.metadata;
      const originBranchValue = Array.isArray(row) ? row[3] : row.origin_branch;

      return {
        name: nameValue,
        created_at: parseInt(createdAtValue || 0),
        metadata: JSON.parse(metadataValue || "{}"),
        origin_branch:
          originBranchValue === "NULL" || !originBranchValue
            ? null
            : originBranchValue,
      };
    },

    async branchExists(branchName: string): Promise<boolean> {
      const branch = await this.getBranch(branchName);
      return branch !== null;
    },
  };
}

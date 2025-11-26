/**
 * Tests for Tool Factory
 */

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { createCollectionTools, createAdapter } from "../src/tool-factory";
import type { DatabaseAdapter } from "../src/types";

// Detect runtime
const _isBun = typeof Bun !== "undefined";

describe("createCollectionTools", () => {
  const testDbFile = "./test-db.sqlite";

  // Helper to create adapter
  async function getAdapter(): Promise<DatabaseAdapter> {
    return await createAdapter({
      type: "sqlite",
      filename: testDbFile,
    });
  }

  // Helper to create a test database with tables
  async function setupTestDatabase() {
    const adapter = await getAdapter();
    const db = (adapter as { db: { exec: (sql: string) => void } }).db;

    // Drop existing tables if they exist
    db.exec(`DROP TABLE IF EXISTS users`);
    db.exec(`DROP TABLE IF EXISTS posts`);
    db.exec(`DROP TABLE IF EXISTS audit_logs`);
    db.exec(`DROP TABLE IF EXISTS no_pk_table`);

    // Create test tables
    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        age INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT,
        updated_by TEXT
      )
    `);

    db.exec(`
      CREATE TABLE posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT,
        user_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.exec(`
      CREATE TABLE audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.exec(`
      CREATE TABLE no_pk_table (
        name TEXT,
        value TEXT
      )
    `);

    await adapter.close();
  }

  beforeEach(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    // Clean up test database file
    try {
      const fs = await import("fs");
      if (fs.existsSync(testDbFile)) {
        fs.unlinkSync(testDbFile);
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("basic tool generation", () => {
    it("should generate tools for all tables", async () => {
      const adapter = await getAdapter();
      const tools = await createCollectionTools(adapter, {
        cache: { enabled: false },
      });

      // Should have at least 6 tools (2 per table: LIST + GET for users, posts, audit_logs)
      expect(tools.length).toBeGreaterThanOrEqual(6);

      // Check for users table tools
      const hasUsersList = tools.some((t) =>
        t.id.includes("COLLECTION_USERS_LIST"),
      );
      const hasUsersGet = tools.some((t) =>
        t.id.includes("COLLECTION_USERS_GET"),
      );

      expect(hasUsersList).toBe(true);
      expect(hasUsersGet).toBe(true);

      await adapter.close();
    });

    it("should generate LIST and GET tools for read-only tables", async () => {
      const adapter = await getAdapter();
      const tools = await createCollectionTools(adapter, {
        mutations: {
          defaultEnabled: false,
        },
        cache: { enabled: false },
      });

      const toolNames = tools.map((t) => t.id);

      // Should have LIST and GET
      expect(toolNames).toContain("DECO_COLLECTION_USERS_LIST");
      expect(toolNames).toContain("DECO_COLLECTION_USERS_GET");

      // Should NOT have CREATE, UPDATE, DELETE
      expect(toolNames).not.toContain("DECO_COLLECTION_USERS_CREATE");
      expect(toolNames).not.toContain("DECO_COLLECTION_USERS_UPDATE");
      expect(toolNames).not.toContain("DECO_COLLECTION_USERS_DELETE");

      await adapter.close();
    });

    it("should generate mutation tools when enabled", async () => {
      const adapter = await getAdapter();
      const tools = await createCollectionTools(adapter, {
        mutations: {
          defaultEnabled: true,
        },
        cache: { enabled: false },
      });

      const toolNames = tools.map((t) => t.id);

      // Should have all CRUD tools
      expect(toolNames).toContain("DECO_COLLECTION_USERS_LIST");
      expect(toolNames).toContain("DECO_COLLECTION_USERS_GET");
      expect(toolNames).toContain("DECO_COLLECTION_USERS_CREATE");
      expect(toolNames).toContain("DECO_COLLECTION_USERS_UPDATE");
      expect(toolNames).toContain("DECO_COLLECTION_USERS_DELETE");

      await adapter.close();
    });
  });

  describe("collection filtering", () => {
    it("should include only specified tables", async () => {
      const adapter = await getAdapter();
      const tools = await createCollectionTools(adapter, {
        collections: {
          mode: "include",
          tables: ["users"],
        },
        cache: { enabled: false },
      });

      const toolNames = tools.map((t) => t.id);

      // Should have users tools
      expect(toolNames.some((n) => n.includes("USERS"))).toBe(true);

      // Should NOT have posts or audit_logs tools
      expect(toolNames.some((n) => n.includes("POSTS"))).toBe(false);
      expect(toolNames.some((n) => n.includes("AUDIT_LOGS"))).toBe(false);

      await adapter.close();
    });

    it("should exclude specified tables", async () => {
      const adapter = await getAdapter();
      const tools = await createCollectionTools(adapter, {
        collections: {
          mode: "exclude",
          tables: ["audit_logs"],
        },
        cache: { enabled: false },
      });

      const toolNames = tools.map((t) => t.id);

      // Should have users and posts tools
      expect(toolNames.some((n) => n.includes("USERS"))).toBe(true);
      expect(toolNames.some((n) => n.includes("POSTS"))).toBe(true);

      // Should NOT have audit_logs tools
      expect(toolNames.some((n) => n.includes("AUDIT_LOGS"))).toBe(false);

      await adapter.close();
    });

    it("should return empty array when include list is empty", async () => {
      const adapter = await getAdapter();
      const tools = await createCollectionTools(adapter, {
        collections: {
          mode: "include",
          tables: [],
        },
        cache: { enabled: false },
      });

      expect(tools).toHaveLength(0);

      await adapter.close();
    });
  });

  describe("per-table mutation configuration", () => {
    it("should respect per-table mutation overrides", async () => {
      const adapter = await getAdapter();
      const tools = await createCollectionTools(adapter, {
        mutations: {
          defaultEnabled: true,
          overrides: [{ table: "audit_logs", enabled: false }],
        },
        cache: { enabled: false },
      });

      const toolNames = tools.map((t) => t.id);

      // Users should have mutations (default)
      expect(toolNames).toContain("DECO_COLLECTION_USERS_CREATE");
      expect(toolNames).toContain("DECO_COLLECTION_USERS_UPDATE");

      // audit_logs should NOT have mutations (override)
      expect(toolNames).not.toContain("DECO_COLLECTION_AUDIT_LOGS_CREATE");
      expect(toolNames).not.toContain("DECO_COLLECTION_AUDIT_LOGS_UPDATE");

      // But should still have LIST and GET
      expect(toolNames).toContain("DECO_COLLECTION_AUDIT_LOGS_LIST");
      expect(toolNames).toContain("DECO_COLLECTION_AUDIT_LOGS_GET");

      await adapter.close();
    });

    it("should enable mutations for specific tables when default is false", async () => {
      const adapter = await getAdapter();
      const tools = await createCollectionTools(adapter, {
        mutations: {
          defaultEnabled: false,
          overrides: [{ table: "users", enabled: true }],
        },
        cache: { enabled: false },
      });

      const toolNames = tools.map((t) => t.id);

      // Users should have mutations (override)
      expect(toolNames).toContain("DECO_COLLECTION_USERS_CREATE");

      // Posts should NOT have mutations (default)
      expect(toolNames).not.toContain("DECO_COLLECTION_POSTS_CREATE");

      await adapter.close();
    });
  });

  describe("tool naming convention", () => {
    it("should use uppercase table names in tool IDs", async () => {
      const adapter = await getAdapter();
      const tools = await createCollectionTools(adapter, {
        cache: { enabled: false },
      });

      const toolNames = tools.map((t) => t.id);

      // All tool names should be uppercase
      expect(toolNames.every((n) => n === n.toUpperCase())).toBe(true);

      await adapter.close();
    });

    it("should follow DECO_COLLECTION_{TABLE}_{OPERATION} format", async () => {
      const adapter = await getAdapter();
      const tools = await createCollectionTools(adapter, {
        cache: { enabled: false },
      });

      const toolNames = tools.map((t) => t.id);

      // Check format
      expect(toolNames.every((n) => n.startsWith("DECO_COLLECTION_"))).toBe(
        true,
      );

      await adapter.close();
    });
  });

  describe("tool schemas", () => {
    it("should have input and output schemas", async () => {
      const adapter = await getAdapter();
      const tools = await createCollectionTools(adapter, {
        cache: { enabled: false },
      });

      tools.forEach((tool) => {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.outputSchema).toBeDefined();
      });

      await adapter.close();
    });

    it("should have descriptions", async () => {
      const adapter = await getAdapter();
      const tools = await createCollectionTools(adapter, {
        cache: { enabled: false },
      });

      tools.forEach((tool) => {
        expect(tool.description).toBeDefined();
        expect(tool.description.length).toBeGreaterThan(0);
      });

      await adapter.close();
    });
  });

  describe("error handling", () => {
    it("should throw error for unsupported database type", async () => {
      await expect(
        createAdapter({ type: "mysql" as "sqlite", filename: "" }),
      ).rejects.toThrow("Unsupported database type");
    });

    it("should skip tables without primary keys", async () => {
      const adapter = await getAdapter();
      const tools = await createCollectionTools(adapter, {
        cache: { enabled: false },
      });

      const toolNames = tools.map((t) => t.id);

      // Should NOT have tools for no_pk_table
      expect(toolNames.some((n) => n.includes("NO_PK_TABLE"))).toBe(false);

      await adapter.close();
    });
  });

  describe("caching", () => {
    it("should use cache when enabled", async () => {
      const adapter = await getAdapter();

      // First call - populates cache
      const tools1 = await createCollectionTools(adapter, {
        cache: { enabled: true, ttl: 60000 },
      });

      // Second call - should use cache
      const tools2 = await createCollectionTools(adapter, {
        cache: { enabled: true, ttl: 60000 },
      });

      expect(tools1.length).toBe(tools2.length);

      await adapter.close();
    });

    it("should skip cache when disabled", async () => {
      const adapter = await getAdapter();

      const tools1 = await createCollectionTools(adapter, {
        cache: { enabled: false },
      });

      const tools2 = await createCollectionTools(adapter, {
        cache: { enabled: false },
      });

      expect(tools1.length).toBe(tools2.length);

      await adapter.close();
    });
  });

  describe("adapter-first API", () => {
    it("should work with adapter instance directly", async () => {
      const adapter = await getAdapter();
      const tools = await createCollectionTools(adapter, {
        cache: { enabled: false },
      });

      expect(tools.length).toBeGreaterThan(0);

      await adapter.close();
    });

    it("should allow custom adapter implementations", async () => {
      // Mock custom adapter
      const customAdapter: DatabaseAdapter = {
        async introspect() {
          return [
            {
              name: "custom_table",
              primaryKey: "id",
              columns: [
                {
                  name: "id",
                  type: "INTEGER",
                  nullable: false,
                  isPrimaryKey: true,
                  isAutoIncrement: true,
                },
                {
                  name: "name",
                  type: "TEXT",
                  nullable: false,
                  isPrimaryKey: false,
                  isAutoIncrement: false,
                },
              ],
              auditFields: {},
            },
          ];
        },
        async query() {
          return [];
        },
        async getById() {
          return null;
        },
        async insert(table: string, data: Record<string, unknown>) {
          return { id: 1, ...data };
        },
        async update(
          table: string,
          id: string | number,
          primaryKey: string,
          data: Record<string, unknown>,
        ) {
          return { id, ...data };
        },
        async delete() {
          return true;
        },
        async close() {
          // No-op
        },
      };

      const tools = await createCollectionTools(customAdapter, {
        cache: { enabled: false },
      });

      // Should generate tools for the custom table
      expect(tools.length).toBeGreaterThan(0);

      // Check tool names contain the custom table
      const toolIds = tools.map((t) => t.id);
      expect(toolIds.some((id) => id.includes("CUSTOM_TABLE"))).toBe(true);
    });

    it("should support all options with adapter", async () => {
      const adapter = await getAdapter();
      const tools = await createCollectionTools(adapter, {
        collections: {
          mode: "include",
          tables: ["users"],
        },
        mutations: {
          defaultEnabled: true,
        },
        cache: {
          enabled: false,
        },
      });

      // Should have 5 tools for users (LIST, GET, CREATE, UPDATE, DELETE)
      const userTools = tools.filter((t) => t.id.includes("USERS"));
      expect(userTools.length).toBe(5);

      await adapter.close();
    });
  });
});

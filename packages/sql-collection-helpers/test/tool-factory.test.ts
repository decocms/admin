/**
 * Tests for Tool Factory
 */

import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { createCollectionTools } from "../src/tool-factory";
import type {
  CreateCollectionToolsConfig,
  DatabaseAdapter,
} from "../src/types";

// Detect runtime
const isBun = typeof Bun !== "undefined";

describe("createCollectionTools", () => {
  const testDbFile = "./test-db.sqlite";

  const sqliteConfig: CreateCollectionToolsConfig = {
    database: {
      type: "sqlite",
      filename: testDbFile,
    },
    cache: {
      enabled: false, // Disable cache for testing
    },
  };

  // Helper to create a test database with tables
  async function setupTestDatabase() {
    let adapter: DatabaseAdapter;

    if (isBun) {
      const { BunSqliteAdapter } = await import(
        "../src/implementations/bun-sqlite"
      );
      adapter = new BunSqliteAdapter(sqliteConfig.database);
    } else {
      const { SqliteAdapter } = await import("../src/implementations/sqlite");
      adapter = new SqliteAdapter(sqliteConfig.database);
    }

    const db = (adapter as any).db;

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
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("basic tool generation", () => {
    it("should generate tools for all tables", async () => {
      const tools = await createCollectionTools(sqliteConfig);

      expect(tools.length).toBeGreaterThan(0);

      // Check that tools are generated for each table
      const toolNames = tools.map((t) => t.id);

      const hasUsersList = toolNames.some(
        (n) => n === "DECO_COLLECTION_USERS_LIST",
      );
      const hasUsersGet = toolNames.some(
        (n) => n === "DECO_COLLECTION_USERS_GET",
      );

      expect(hasUsersList).toBe(true);
      expect(hasUsersGet).toBe(true);
    });

    it("should generate LIST and GET tools for read-only tables", async () => {
      const config: CreateCollectionToolsConfig = {
        ...sqliteConfig,
        mutations: {
          defaultEnabled: false,
        },
      };

      const tools = await createCollectionTools(config);
      const toolNames = tools.map((t) => t.id);

      // Should have LIST and GET
      expect(toolNames).toContain("DECO_COLLECTION_USERS_LIST");
      expect(toolNames).toContain("DECO_COLLECTION_USERS_GET");

      // Should NOT have CREATE, UPDATE, DELETE
      expect(toolNames).not.toContain("DECO_COLLECTION_USERS_CREATE");
      expect(toolNames).not.toContain("DECO_COLLECTION_USERS_UPDATE");
      expect(toolNames).not.toContain("DECO_COLLECTION_USERS_DELETE");
    });

    it("should generate mutation tools when enabled", async () => {
      const config: CreateCollectionToolsConfig = {
        ...sqliteConfig,
        mutations: {
          defaultEnabled: true,
        },
      };

      const tools = await createCollectionTools(config);
      const toolNames = tools.map((t) => t.id);

      // Should have all CRUD tools
      expect(toolNames).toContain("DECO_COLLECTION_USERS_LIST");
      expect(toolNames).toContain("DECO_COLLECTION_USERS_GET");
      expect(toolNames).toContain("DECO_COLLECTION_USERS_CREATE");
      expect(toolNames).toContain("DECO_COLLECTION_USERS_UPDATE");
      expect(toolNames).toContain("DECO_COLLECTION_USERS_DELETE");
    });
  });

  describe("collection filtering", () => {
    it("should include only specified tables", async () => {
      const config: CreateCollectionToolsConfig = {
        ...sqliteConfig,
        collections: {
          mode: "include",
          tables: ["users"],
        },
      };

      const tools = await createCollectionTools(config);
      const toolNames = tools.map((t) => t.id);

      // Should have users tools
      expect(toolNames.some((n) => n.includes("USERS"))).toBe(true);

      // Should NOT have posts or audit_logs tools
      expect(toolNames.some((n) => n.includes("POSTS"))).toBe(false);
      expect(toolNames.some((n) => n.includes("AUDIT_LOGS"))).toBe(false);
    });

    it("should exclude specified tables", async () => {
      const config: CreateCollectionToolsConfig = {
        ...sqliteConfig,
        collections: {
          mode: "exclude",
          tables: ["audit_logs"],
        },
      };

      const tools = await createCollectionTools(config);
      const toolNames = tools.map((t) => t.id);

      // Should have users and posts tools
      expect(toolNames.some((n) => n.includes("USERS"))).toBe(true);
      expect(toolNames.some((n) => n.includes("POSTS"))).toBe(true);

      // Should NOT have audit_logs tools
      expect(toolNames.some((n) => n.includes("AUDIT_LOGS"))).toBe(false);
    });

    it("should return empty array when include list is empty", async () => {
      const config: CreateCollectionToolsConfig = {
        ...sqliteConfig,
        collections: {
          mode: "include",
          tables: [],
        },
      };

      const tools = await createCollectionTools(config);
      expect(tools).toHaveLength(0);
    });
  });

  describe("per-table mutation configuration", () => {
    it("should respect per-table mutation overrides", async () => {
      const config: CreateCollectionToolsConfig = {
        ...sqliteConfig,
        mutations: {
          defaultEnabled: true,
          overrides: [{ table: "audit_logs", enabled: false }],
        },
      };

      const tools = await createCollectionTools(config);
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
    });

    it("should enable mutations for specific tables when default is false", async () => {
      const config: CreateCollectionToolsConfig = {
        ...sqliteConfig,
        mutations: {
          defaultEnabled: false,
          overrides: [{ table: "users", enabled: true }],
        },
      };

      const tools = await createCollectionTools(config);
      const toolNames = tools.map((t) => t.id);

      // Users should have mutations (override)
      expect(toolNames).toContain("DECO_COLLECTION_USERS_CREATE");

      // Posts should NOT have mutations (default)
      expect(toolNames).not.toContain("DECO_COLLECTION_POSTS_CREATE");
    });
  });

  describe("tool naming convention", () => {
    it("should use uppercase table names in tool IDs", async () => {
      const tools = await createCollectionTools(sqliteConfig);

      const usersTool = tools.find(
        (t) => t.id === "DECO_COLLECTION_USERS_LIST",
      );
      expect(usersTool).toBeDefined();
    });

    it("should follow DECO_COLLECTION_{TABLE}_{OPERATION} format", async () => {
      const config: CreateCollectionToolsConfig = {
        ...sqliteConfig,
        mutations: {
          defaultEnabled: true,
        },
      };

      const tools = await createCollectionTools(config);
      const toolNames = tools.map((t) => t.id);

      // Check format for users table
      expect(toolNames).toContain("DECO_COLLECTION_USERS_LIST");
      expect(toolNames).toContain("DECO_COLLECTION_USERS_GET");
      expect(toolNames).toContain("DECO_COLLECTION_USERS_CREATE");
      expect(toolNames).toContain("DECO_COLLECTION_USERS_UPDATE");
      expect(toolNames).toContain("DECO_COLLECTION_USERS_DELETE");
    });
  });

  describe("tool schemas", () => {
    it("should have input and output schemas", async () => {
      const config: CreateCollectionToolsConfig = {
        ...sqliteConfig,
        mutations: {
          defaultEnabled: true,
        },
      };

      const tools = await createCollectionTools(config);
      const listTool = tools.find((t) => t.id === "DECO_COLLECTION_USERS_LIST");

      expect(listTool).toBeDefined();
      expect(listTool!.inputSchema).toBeDefined();
      expect(listTool!.outputSchema).toBeDefined();
    });

    it("should have descriptions", async () => {
      const tools = await createCollectionTools(sqliteConfig);
      const listTool = tools.find((t) => t.id === "DECO_COLLECTION_USERS_LIST");

      expect(listTool).toBeDefined();
      expect(listTool!.description).toBeDefined();
      expect(listTool!.description.length).toBeGreaterThan(0);
    });
  });

  describe("error handling", () => {
    it("should throw error for unsupported database type", async () => {
      const config = {
        database: {
          type: "mysql" as any,
          connectionString: "mysql://localhost/test",
        },
      };

      await expect(createCollectionTools(config)).rejects.toThrow(
        "Unsupported database type",
      );
    });

    it("should skip tables without primary keys", async () => {
      // Create a table without primary key
      let adapter: DatabaseAdapter;

      if (isBun) {
        const { BunSqliteAdapter } = await import(
          "../src/implementations/bun-sqlite"
        );
        adapter = new BunSqliteAdapter(sqliteConfig.database);
      } else {
        const { SqliteAdapter } = await import("../src/implementations/sqlite");
        adapter = new SqliteAdapter(sqliteConfig.database);
      }
      const db = (adapter as any).db;

      db.exec(`
        CREATE TABLE no_pk_table (
          name TEXT NOT NULL,
          value TEXT
        )
      `);

      await adapter.close();

      const tools = await createCollectionTools(sqliteConfig);
      const toolNames = tools.map((t) => t.id);

      // Should not have tools for no_pk_table
      expect(toolNames.some((n) => n.includes("NO_PK_TABLE"))).toBe(false);
    });
  });

  describe("caching", () => {
    it("should use cache when enabled", async () => {
      const config: CreateCollectionToolsConfig = {
        ...sqliteConfig,
        cache: {
          enabled: true,
          ttl: 60000,
        },
      };

      // First call - should introspect
      const tools1 = await createCollectionTools(config);

      // Second call - should use cache
      const tools2 = await createCollectionTools(config);

      expect(tools1.length).toBe(tools2.length);
    });

    it("should skip cache when disabled", async () => {
      const config: CreateCollectionToolsConfig = {
        ...sqliteConfig,
        cache: {
          enabled: false,
        },
      };

      const tools1 = await createCollectionTools(config);
      const tools2 = await createCollectionTools(config);

      expect(tools1.length).toBe(tools2.length);
    });
  });
});

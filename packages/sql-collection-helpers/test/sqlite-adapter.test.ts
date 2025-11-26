/**
 * Tests for SQLite Adapter
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { SqliteConfig, DatabaseAdapter } from "../src/types";

// Detect runtime and use appropriate adapter
const isBun = typeof Bun !== "undefined";

async function createAdapter(config: SqliteConfig): Promise<DatabaseAdapter> {
  if (isBun) {
    const { BunSqliteAdapter } = await import(
      "../src/implementations/bun-sqlite"
    );
    return new BunSqliteAdapter(config);
  }
  const { SqliteAdapter } = await import("../src/implementations/sqlite");
  return new SqliteAdapter(config);
}

async function createIntrospector(filename: string) {
  if (isBun) {
    const { SqliteIntrospectorBun } = await import(
      "../src/introspection/bun-sqlite"
    );
    return new SqliteIntrospectorBun(filename);
  }
  const { SqliteIntrospector } = await import("../src/introspection/sqlite");
  return new SqliteIntrospector(filename);
}

describe("SqliteAdapter", () => {
  let adapter: DatabaseAdapter;
  const config: SqliteConfig = {
    type: "sqlite",
    filename: ":memory:",
  };

  beforeEach(async () => {
    adapter = await createAdapter(config);

    // Create test table
    const introspector = await createIntrospector(":memory:");
    await introspector.close();
  });

  afterEach(async () => {
    await adapter.close();
  });

  describe("introspection", () => {
    it("should introspect empty database", async () => {
      const tables = await adapter.introspect();
      expect(Array.isArray(tables)).toBe(true);
    });
  });

  describe("CRUD operations with test table", () => {
    beforeEach(() => {
      // Create a test table directly
      const db = (adapter as any).db;
      db.exec(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          age INTEGER,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);
    });

    it("should insert a record", async () => {
      const data = {
        name: "John Doe",
        email: "john@example.com",
        age: 30,
      };

      const result = await adapter.insert("users", data);

      expect(result).toBeDefined();
      expect(result.name).toBe("John Doe");
      expect(result.email).toBe("john@example.com");
      expect(result.age).toBe(30);
    });

    it("should get a record by id", async () => {
      // Insert first
      const inserted = await adapter.insert("users", {
        name: "Jane Doe",
        email: "jane@example.com",
        age: 25,
      });

      // Then get
      const result = await adapter.getById(
        "users",
        inserted.id as number,
        "id",
      );

      expect(result).toBeDefined();
      expect(result?.name).toBe("Jane Doe");
      expect(result?.email).toBe("jane@example.com");
    });

    it("should return null for non-existent id", async () => {
      const result = await adapter.getById("users", 99999, "id");
      expect(result).toBeNull();
    });

    it("should update a record", async () => {
      // Insert first
      const inserted = await adapter.insert("users", {
        name: "Bob Smith",
        email: "bob@example.com",
        age: 35,
      });

      // Then update
      const updated = await adapter.update(
        "users",
        inserted.id as number,
        "id",
        {
          age: 36,
        },
      );

      expect(updated).toBeDefined();
      expect(updated.age).toBe(36);
      expect(updated.name).toBe("Bob Smith"); // Unchanged
    });

    it("should throw error when updating non-existent record", async () => {
      await expect(
        adapter.update("users", 99999, "id", { age: 40 }),
      ).rejects.toThrow();
    });

    it("should delete a record", async () => {
      // Insert first
      const inserted = await adapter.insert("users", {
        name: "Alice Johnson",
        email: "alice@example.com",
        age: 28,
      });

      // Then delete
      const deleted = await adapter.delete(
        "users",
        inserted.id as number,
        "id",
      );
      expect(deleted).toBe(true);

      // Verify deletion
      const result = await adapter.getById(
        "users",
        inserted.id as number,
        "id",
      );
      expect(result).toBeNull();
    });

    it("should return false when deleting non-existent record", async () => {
      const deleted = await adapter.delete("users", 99999, "id");
      expect(deleted).toBe(false);
    });

    it("should query records with limit", async () => {
      // Insert multiple records
      await adapter.insert("users", {
        name: "User 1",
        email: "user1@example.com",
        age: 20,
      });
      await adapter.insert("users", {
        name: "User 2",
        email: "user2@example.com",
        age: 21,
      });
      await adapter.insert("users", {
        name: "User 3",
        email: "user3@example.com",
        age: 22,
      });

      const results = await adapter.query("users", { limit: 2 });

      expect(results).toHaveLength(2);
    });

    it("should query records with offset", async () => {
      // Insert multiple records
      await adapter.insert("users", {
        name: "User 1",
        email: "user1@example.com",
        age: 20,
      });
      await adapter.insert("users", {
        name: "User 2",
        email: "user2@example.com",
        age: 21,
      });
      await adapter.insert("users", {
        name: "User 3",
        email: "user3@example.com",
        age: 22,
      });

      const results = await adapter.query("users", { offset: 1, limit: 2 });

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe("User 2");
    });

    it("should query records with ordering", async () => {
      // Insert multiple records
      await adapter.insert("users", {
        name: "Charlie",
        email: "charlie@example.com",
        age: 30,
      });
      await adapter.insert("users", {
        name: "Alice",
        email: "alice@example.com",
        age: 25,
      });
      await adapter.insert("users", {
        name: "Bob",
        email: "bob@example.com",
        age: 35,
      });

      const results = await adapter.query("users", {
        orderBy: [{ field: ["name"], direction: "asc" }],
      });

      expect(results[0].name).toBe("Alice");
      expect(results[1].name).toBe("Bob");
      expect(results[2].name).toBe("Charlie");
    });

    it("should query records with WHERE filter", async () => {
      // Insert multiple records
      await adapter.insert("users", {
        name: "John",
        email: "john@example.com",
        age: 30,
      });
      await adapter.insert("users", {
        name: "Jane",
        email: "jane@example.com",
        age: 25,
      });
      await adapter.insert("users", {
        name: "Bob",
        email: "bob@example.com",
        age: 30,
      });

      const results = await adapter.query("users", {
        where: {
          field: ["age"],
          operator: "eq",
          value: 30,
        },
      });

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.age === 30)).toBe(true);
    });
  });
});

describe("SqliteIntrospector", () => {
  it("should introspect database schema", async () => {
    const introspector = await createIntrospector(":memory:");

    // Create a test table
    const db = (introspector as any).db;
    db.exec(`
      CREATE TABLE test_table (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        value INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const tables = await introspector.introspect();

    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe("test_table");
    expect(tables[0].primaryKey).toBe("id");
    expect(tables[0].columns).toHaveLength(4);

    const idColumn = tables[0].columns.find((c) => c.name === "id");
    expect(idColumn?.isPrimaryKey).toBe(true);
    expect(idColumn?.isAutoIncrement).toBe(true);

    await introspector.close();
  });

  it("should detect audit fields", async () => {
    const introspector = await createIntrospector(":memory:");

    const db = (introspector as any).db;
    db.exec(`
      CREATE TABLE audit_table (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT,
        updated_at TEXT,
        created_by TEXT,
        updated_by TEXT
      )
    `);

    const tables = await introspector.introspect();

    expect(tables[0].auditFields.createdAt).toBe("created_at");
    expect(tables[0].auditFields.updatedAt).toBe("updated_at");
    expect(tables[0].auditFields.createdBy).toBe("created_by");
    expect(tables[0].auditFields.updatedBy).toBe("updated_by");

    await introspector.close();
  });

  it("should exclude sqlite internal tables", async () => {
    const introspector = await createIntrospector(":memory:");

    const db = (introspector as any).db;
    db.exec(`CREATE TABLE user_table (id INTEGER PRIMARY KEY)`);
    db.exec(`CREATE TABLE mastra_internal (id INTEGER PRIMARY KEY)`);

    const tables = await introspector.introspect();

    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe("user_table");

    await introspector.close();
  });
});

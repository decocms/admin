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
      const db = (adapter as { db: { exec: (sql: string) => void } }).db;
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

  describe("SQL Injection Protection", () => {
    beforeEach(() => {
      // Create a test table directly
      const db = (adapter as { db: { exec: (sql: string) => void } }).db;
      db.exec(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          age INTEGER,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);
    });

    describe("Table name validation", () => {
      it("should reject table names with SQL injection attempts", async () => {
        await expect(
          adapter.query("users; DROP TABLE users; --", {}),
        ).rejects.toThrow(/Invalid table name/);
      });

      it("should reject table names with special characters", async () => {
        await expect(adapter.query("users' OR '1'='1", {})).rejects.toThrow(
          /Invalid table name/,
        );
      });

      it("should reject table names starting with numbers", async () => {
        await expect(adapter.query("123users", {})).rejects.toThrow(
          /Invalid table name/,
        );
      });

      it("should accept valid table names with underscores", async () => {
        const db = (adapter as { db: { exec: (sql: string) => void } }).db;
        db.exec("CREATE TABLE user_profiles (id INTEGER PRIMARY KEY)");

        const result = await adapter.query("user_profiles", {});
        expect(Array.isArray(result)).toBe(true);
      });
    });

    describe("Primary key validation", () => {
      it("should reject primary keys with SQL injection attempts", async () => {
        const inserted = await adapter.insert("users", {
          name: "Test",
          email: "test@example.com",
          age: 30,
        });

        await expect(
          adapter.getById(
            "users",
            inserted.id as number,
            "id; DROP TABLE users; --",
          ),
        ).rejects.toThrow(/Invalid primary key/);
      });

      it("should reject primary keys with special characters", async () => {
        await expect(
          adapter.getById("users", 1, "id' OR '1'='1"),
        ).rejects.toThrow(/Invalid primary key/);
      });

      it("should accept valid primary keys", async () => {
        const inserted = await adapter.insert("users", {
          name: "Test",
          email: "test@example.com",
          age: 30,
        });

        const result = await adapter.getById(
          "users",
          inserted.id as number,
          "id",
        );
        expect(result).toBeDefined();
      });
    });

    describe("ORDER BY field validation", () => {
      beforeEach(async () => {
        await adapter.insert("users", {
          name: "Alice",
          email: "alice@example.com",
          age: 25,
        });
        await adapter.insert("users", {
          name: "Bob",
          email: "bob@example.com",
          age: 30,
        });
      });

      it("should reject ORDER BY with SQL injection attempts", async () => {
        await expect(
          adapter.query("users", {
            orderBy: [
              { field: ["name; DROP TABLE users; --"], direction: "asc" },
            ],
          }),
        ).rejects.toThrow(/Invalid ORDER BY field segment/);
      });

      it("should reject ORDER BY with special characters in field", async () => {
        await expect(
          adapter.query("users", {
            orderBy: [{ field: ["name' OR '1'='1"], direction: "asc" }],
          }),
        ).rejects.toThrow(/Invalid ORDER BY field segment/);
      });

      it("should reject ORDER BY with invalid field starting with number", async () => {
        await expect(
          adapter.query("users", {
            orderBy: [{ field: ["123name"], direction: "asc" }],
          }),
        ).rejects.toThrow(/Invalid ORDER BY field segment/);
      });

      it("should accept valid ORDER BY fields", async () => {
        const results = await adapter.query("users", {
          orderBy: [{ field: ["name"], direction: "asc" }],
        });

        expect(results).toHaveLength(2);
        expect(results[0].name).toBe("Alice");
      });

      it("should accept valid ORDER BY with underscores", async () => {
        const results = await adapter.query("users", {
          orderBy: [{ field: ["created_at"], direction: "desc" }],
        });

        expect(Array.isArray(results)).toBe(true);
      });
    });

    describe("ORDER BY direction validation", () => {
      beforeEach(async () => {
        await adapter.insert("users", {
          name: "Alice",
          email: "alice@example.com",
          age: 25,
        });
      });

      it("should reject invalid ORDER BY direction", async () => {
        await expect(
          adapter.query("users", {
            orderBy: [{ field: ["name"], direction: "DROP TABLE" as "asc" }],
          }),
        ).rejects.toThrow(/Invalid ORDER BY direction/);
      });

      it("should reject ORDER BY direction with SQL injection", async () => {
        await expect(
          adapter.query("users", {
            orderBy: [
              { field: ["name"], direction: "ASC; DROP TABLE users" as "asc" },
            ],
          }),
        ).rejects.toThrow(/Invalid ORDER BY direction/);
      });

      it("should accept lowercase asc/desc", async () => {
        const results = await adapter.query("users", {
          orderBy: [{ field: ["name"], direction: "asc" }],
        });
        expect(Array.isArray(results)).toBe(true);
      });

      it("should accept uppercase ASC/DESC", async () => {
        const results = await adapter.query("users", {
          orderBy: [{ field: ["name"], direction: "DESC" as "desc" }],
        });
        expect(Array.isArray(results)).toBe(true);
      });

      it("should accept mixed case", async () => {
        const results = await adapter.query("users", {
          orderBy: [{ field: ["name"], direction: "AsC" as "asc" }],
        });
        expect(Array.isArray(results)).toBe(true);
      });
    });

    describe("INSERT column name validation", () => {
      it("should reject INSERT with invalid column names", async () => {
        await expect(
          adapter.insert("users", {
            name: "Test",
            email: "test@example.com",
            "age; DROP TABLE users; --": 30,
          }),
        ).rejects.toThrow(/Invalid column names/);
      });

      it("should reject INSERT with non-existent columns", async () => {
        await expect(
          adapter.insert("users", {
            name: "Test",
            email: "test@example.com",
            nonexistent_column: "value",
          }),
        ).rejects.toThrow(/Invalid column names/);
      });

      it("should reject INSERT with SQL injection in column name", async () => {
        await expect(
          adapter.insert("users", {
            name: "Test",
            "email' OR '1'='1": "test@example.com",
          }),
        ).rejects.toThrow(/Invalid column names/);
      });

      it("should accept INSERT with valid column names", async () => {
        const result = await adapter.insert("users", {
          name: "John Doe",
          email: "john@example.com",
          age: 30,
        });

        expect(result).toBeDefined();
        expect(result.name).toBe("John Doe");
      });

      it("should provide helpful error message listing valid columns", async () => {
        try {
          await adapter.insert("users", {
            name: "Test",
            invalid_col: "value",
          });
          expect.fail("Should have thrown an error");
        } catch (error) {
          expect((error as Error).message).toContain("invalid_col");
          expect((error as Error).message).toContain("Valid columns are:");
          expect((error as Error).message).toContain("name");
          expect((error as Error).message).toContain("email");
        }
      });
    });

    describe("UPDATE column name validation", () => {
      it("should reject UPDATE with invalid column names", async () => {
        const inserted = await adapter.insert("users", {
          name: "Test",
          email: "test@example.com",
          age: 30,
        });

        await expect(
          adapter.update("users", inserted.id as number, "id", {
            "age; DROP TABLE users; --": 31,
          }),
        ).rejects.toThrow(/Invalid column names/);
      });

      it("should reject UPDATE with non-existent columns", async () => {
        const inserted = await adapter.insert("users", {
          name: "Test",
          email: "test@example.com",
          age: 30,
        });

        await expect(
          adapter.update("users", inserted.id as number, "id", {
            nonexistent_column: "value",
          }),
        ).rejects.toThrow(/Invalid column names/);
      });

      it("should reject UPDATE with SQL injection in column name", async () => {
        const inserted = await adapter.insert("users", {
          name: "Test",
          email: "test@example.com",
          age: 30,
        });

        await expect(
          adapter.update("users", inserted.id as number, "id", {
            "name' OR '1'='1": "Hacked",
          }),
        ).rejects.toThrow(/Invalid column names/);
      });

      it("should accept UPDATE with valid column names", async () => {
        const inserted = await adapter.insert("users", {
          name: "John Doe",
          email: "john@example.com",
          age: 30,
        });

        const result = await adapter.update(
          "users",
          inserted.id as number,
          "id",
          {
            age: 31,
          },
        );

        expect(result).toBeDefined();
        expect(result.age).toBe(31);
      });
    });

    describe("WHERE clause field validation", () => {
      beforeEach(async () => {
        await adapter.insert("users", {
          name: "Alice",
          email: "alice@example.com",
          age: 25,
        });
        await adapter.insert("users", {
          name: "Bob",
          email: "bob@example.com",
          age: 30,
        });
      });

      it("should reject WHERE clause with SQL injection in field", async () => {
        await expect(
          adapter.query("users", {
            where: {
              field: ["age; DROP TABLE users; --"],
              operator: "eq",
              value: 25,
            },
          }),
        ).rejects.toThrow(/Invalid ORDER BY field segment/);
      });

      it("should reject WHERE clause with special characters in field", async () => {
        await expect(
          adapter.query("users", {
            where: {
              field: ["age' OR '1'='1"],
              operator: "eq",
              value: 25,
            },
          }),
        ).rejects.toThrow(/Invalid ORDER BY field segment/);
      });

      it("should accept WHERE clause with valid field names", async () => {
        const results = await adapter.query("users", {
          where: {
            field: ["age"],
            operator: "eq",
            value: 25,
          },
        });

        expect(results).toHaveLength(1);
        expect(results[0].name).toBe("Alice");
      });

      it("should accept WHERE clause with valid field names using underscores", async () => {
        const results = await adapter.query("users", {
          where: {
            field: ["created_at"],
            operator: "gt",
            value: "2000-01-01",
          },
        });

        expect(Array.isArray(results)).toBe(true);
      });
    });

    describe("Multi-segment field paths", () => {
      it("should validate each segment in dotted field paths", async () => {
        await expect(
          adapter.query("users", {
            orderBy: [{ field: ["valid", "invalid!"], direction: "asc" }],
          }),
        ).rejects.toThrow(/Invalid ORDER BY field segment/);
      });

      it("should reject if any segment contains SQL injection", async () => {
        await expect(
          adapter.query("users", {
            orderBy: [
              { field: ["valid", "DROP TABLE users"], direction: "asc" },
            ],
          }),
        ).rejects.toThrow(/Invalid ORDER BY field segment/);
      });
    });

    describe("Schema caching", () => {
      it("should cache table schema and reuse it", async () => {
        // First call populates cache
        const result1 = await adapter.insert("users", {
          name: "Test1",
          email: "test1@example.com",
          age: 30,
        });
        expect(result1).toBeDefined();

        // Second call should use cached schema
        const result2 = await adapter.insert("users", {
          name: "Test2",
          email: "test2@example.com",
          age: 31,
        });
        expect(result2).toBeDefined();

        // Both should work correctly
        const allUsers = await adapter.query("users", {});
        expect(allUsers).toHaveLength(2);
      });

      it("should still validate against cached schema", async () => {
        // Populate cache with valid insert
        await adapter.insert("users", {
          name: "Test",
          email: "test@example.com",
          age: 30,
        });

        // Try invalid column with cached schema
        await expect(
          adapter.insert("users", {
            name: "Test2",
            invalid_col: "value",
          }),
        ).rejects.toThrow(/Invalid column names/);
      });
    });

    describe("Edge cases", () => {
      it("should reject empty field arrays", async () => {
        await expect(
          adapter.query("users", {
            orderBy: [{ field: [], direction: "asc" }],
          }),
        ).rejects.toThrow(/ORDER BY field cannot be empty/);
      });

      it("should handle table names at maximum valid length", async () => {
        // SQLite typically allows up to 255 characters
        const longValidName = "a".repeat(255);
        // This will fail because table doesn't exist, but should pass validation
        await expect(adapter.query(longValidName, {})).rejects.toThrow(
          /no such table/,
        );
      });
    });
  });
});

describe("SqliteIntrospector", () => {
  it("should introspect database schema", async () => {
    const introspector = await createIntrospector(":memory:");

    // Create a test table
    const db = (introspector as { db: { exec: (sql: string) => void } }).db;
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

    const db = (introspector as { db: { exec: (sql: string) => void } }).db;
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

    const db = (introspector as { db: { exec: (sql: string) => void } }).db;
    db.exec(`CREATE TABLE user_table (id INTEGER PRIMARY KEY)`);
    db.exec(`CREATE TABLE mastra_internal (id INTEGER PRIMARY KEY)`);

    const tables = await introspector.introspect();

    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe("user_table");

    await introspector.close();
  });
});

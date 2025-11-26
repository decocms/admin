/**
 * Simplified Tests for Drizzle Adapter - Focus on Lazy Initialization
 *
 * Note: Full SQL operations are tested in sqlite-adapter.test.ts
 * These tests focus on the unique aspect of DrizzleAdapter: lazy initialization with context
 */

import { describe, it, expect } from "vitest";
import { DrizzleAdapter, createCollectionTools } from "../src/index";
import type { SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";

describe("DrizzleAdapter - Lazy Initialization", () => {
  describe("factory pattern", () => {
    it("should not call factory during adapter creation", () => {
      let factoryCalled = false;

      new DrizzleAdapter(() => {
        factoryCalled = true;
        return {} as SqliteRemoteDatabase;
      });

      expect(factoryCalled).toBe(false);
    });

    it("should pass context to factory function", async () => {
      let receivedContext: unknown = null;

      const mockDb = {
        all: async () => [],
        get: async () => null,
        run: async () => {},
      } as SqliteRemoteDatabase;

      const adapter = new DrizzleAdapter((context) => {
        receivedContext = context;
        return mockDb;
      });

      const mockContext = {
        runtimeContext: {
          get: (key: string) => {
            if (key === "env") {
              return { DECO_WORKSPACE_DB: "mock-db" };
            }
            return undefined;
          },
        },
      };

      // Call a method that uses the factory
      await adapter.query("users", {}, mockContext);

      expect(receivedContext).toBeDefined();
      expect(receivedContext.runtimeContext).toBeDefined();
      expect(receivedContext.runtimeContext.get("env")).toEqual({
        DECO_WORKSPACE_DB: "mock-db",
      });

      await adapter.close();
    });

    it("should call factory for each database operation", async () => {
      let factoryCallCount = 0;

      const mockDb = {
        all: async () => [],
        get: async () => null,
        run: async () => {},
      } as SqliteRemoteDatabase;

      const adapter = new DrizzleAdapter(() => {
        factoryCallCount++;
        return mockDb;
      });

      await adapter.query("users", {});
      expect(factoryCallCount).toBeGreaterThan(0);

      const previousCount = factoryCallCount;
      await adapter.query("posts", {});
      expect(factoryCallCount).toBeGreaterThan(previousCount);

      await adapter.close();
    });
  });

  describe("context propagation", () => {
    it("should pass context through all CRUD operations", async () => {
      const contexts: unknown[] = [];

      const mockDb = {
        all: async () => [],
        get: async () => ({ id: 1, name: "test" }),
        run: async () => {},
      } as SqliteRemoteDatabase;

      const adapter = new DrizzleAdapter((context) => {
        contexts.push(context);
        return mockDb;
      });

      const mockContext = {
        runtimeContext: {
          get: () => ({ TEST: "value" }),
        },
      };

      // Test each operation passes context
      await adapter.query("users", {}, mockContext);
      await adapter.getById("users", 1, "id", mockContext);

      // Verify context was passed
      expect(contexts.length).toBeGreaterThan(0);
      expect(contexts.every((ctx) => ctx === mockContext)).toBe(true);

      await adapter.close();
    });
  });

  describe("introspection", () => {
    it("should introspect tables correctly", async () => {
      const mockDb = {
        all: async (query: unknown) => {
          // Extract SQL from Drizzle SQL object
          let sqlStr = "";
          if (
            query &&
            typeof query === "object" &&
            "queryChunks" in query &&
            Array.isArray(query.queryChunks)
          ) {
            sqlStr = query.queryChunks
              .map(
                (chunk: unknown) =>
                  (chunk as { value?: string[] })?.value?.[0] || "",
              )
              .join("");
          } else {
            sqlStr = String(query);
          }

          if (sqlStr.includes("sqlite_master")) {
            // Return table list as arrays (proxy format)
            return [["users"]];
          }
          if (sqlStr.includes("PRAGMA")) {
            // Return column info as arrays: [cid, name, type, notnull, dflt_value, pk]
            return [
              [0, "id", "INTEGER", 1, null, 1],
              [1, "name", "TEXT", 1, null, 0],
            ];
          }
          return [];
        },
        get: async () => null,
        run: async () => {},
      } as unknown as SqliteRemoteDatabase;

      const adapter = new DrizzleAdapter(() => mockDb);
      const tables = await adapter.introspect();

      expect(tables.length).toBe(1);
      expect(tables[0].name).toBe("users");
      expect(tables[0].primaryKey).toBe("id");
      expect(tables[0].columns.length).toBe(2);

      await adapter.close();
    });
  });

  describe("integration with createCollectionTools", () => {
    it("should work with createCollectionTools", async () => {
      // Mock database that returns minimal introspection data
      const mockDb = {
        all: async (query: unknown) => {
          let sqlStr = "";
          if (
            query &&
            typeof query === "object" &&
            "queryChunks" in query &&
            Array.isArray(query.queryChunks)
          ) {
            sqlStr = query.queryChunks
              .map(
                (chunk: unknown) =>
                  (chunk as { value?: string[] })?.value?.[0] || "",
              )
              .join("");
          } else {
            sqlStr = String(query);
          }

          if (sqlStr.includes("sqlite_master")) {
            // Return table list
            return [["users"], ["posts"]];
          }
          if (sqlStr.includes("PRAGMA")) {
            // Return column info: [cid, name, type, notnull, dflt_value, pk]
            return [
              [0, "id", "INTEGER", 1, null, 1],
              [1, "name", "TEXT", 1, null, 0],
            ];
          }
          return [];
        },
        get: async () => null,
        run: async () => {},
      } as unknown as SqliteRemoteDatabase;

      const adapter = new DrizzleAdapter(() => mockDb);

      const tools = await createCollectionTools(adapter, {
        cache: { enabled: false },
      });

      expect(tools.length).toBeGreaterThan(0);

      await adapter.close();
    });

    it("should create tools that use lazy initialization", async () => {
      let factoryCalled = false;

      const mockDb = {
        all: async (query: unknown) => {
          let sqlStr = "";
          if (
            query &&
            typeof query === "object" &&
            "queryChunks" in query &&
            Array.isArray(query.queryChunks)
          ) {
            sqlStr = query.queryChunks
              .map(
                (chunk: unknown) =>
                  (chunk as { value?: string[] })?.value?.[0] || "",
              )
              .join("");
          } else {
            sqlStr = String(query);
          }

          if (sqlStr.includes("sqlite_master")) {
            return [["users"]];
          }
          if (sqlStr.includes("PRAGMA")) {
            return [
              [0, "id", "INTEGER", 1, null, 1],
              [1, "name", "TEXT", 1, null, 0],
            ];
          }
          return [];
        },
        get: async () => null,
        run: async () => {},
      } as unknown as SqliteRemoteDatabase;

      const adapter = new DrizzleAdapter(() => {
        factoryCalled = true;
        return mockDb;
      });

      const tools = await createCollectionTools(adapter, {
        cache: { enabled: false },
        collections: {
          mode: "include",
          tables: ["users"],
        },
      });

      // Factory should have been called during introspection
      expect(factoryCalled).toBe(true);
      expect(tools.length).toBeGreaterThan(0);

      await adapter.close();
    });
  });

  describe("error handling", () => {
    it("should handle factory errors gracefully", async () => {
      const adapter = new DrizzleAdapter(() => {
        throw new Error("Factory failed");
      });

      await expect(adapter.query("users", {})).rejects.toThrow(
        "Factory failed",
      );

      await adapter.close();
    });

    it("should validate table names even with lazy initialization", async () => {
      const mockDb = {
        all: async () => [],
        get: async () => null,
        run: async () => {},
      } as SqliteRemoteDatabase;

      const adapter = new DrizzleAdapter(() => mockDb);

      // Should reject invalid table name before calling factory
      await expect(
        adapter.query("users; DROP TABLE users; --", {}),
      ).rejects.toThrow(/Invalid table name/);

      await adapter.close();
    });
  });
});

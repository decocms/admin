/**
 * Tests for type definitions and configurations
 */

import { describe, it, expect } from "vitest";
import type {
  DatabaseConfig,
  CollectionConfig,
  MutationConfig,
  CreateCollectionToolsConfig,
} from "../src/types";

describe("Type definitions", () => {
  it("should accept valid PostgreSQL config", () => {
    const config: DatabaseConfig = {
      type: "postgres",
      connectionString: "postgresql://localhost:5432/test",
      schema: "public",
    };

    expect(config.type).toBe("postgres");
    expect(config.connectionString).toBeDefined();
  });

  it("should accept valid SQLite config", () => {
    const config: DatabaseConfig = {
      type: "sqlite",
      filename: ":memory:",
    };

    expect(config.type).toBe("sqlite");
    expect(config.filename).toBe(":memory:");
  });

  it("should accept collection config with all mode", () => {
    const config: CollectionConfig = {
      mode: "all",
    };

    expect(config.mode).toBe("all");
  });

  it("should accept collection config with include mode", () => {
    const config: CollectionConfig = {
      mode: "include",
      tables: ["users", "posts"],
    };

    expect(config.mode).toBe("include");
    expect(config.tables).toHaveLength(2);
  });

  it("should accept collection config with exclude mode", () => {
    const config: CollectionConfig = {
      mode: "exclude",
      tables: ["_migrations"],
    };

    expect(config.mode).toBe("exclude");
    expect(config.tables).toHaveLength(1);
  });

  it("should accept mutation config with defaults", () => {
    const config: MutationConfig = {
      defaultEnabled: true,
    };

    expect(config.defaultEnabled).toBe(true);
  });

  it("should accept mutation config with overrides", () => {
    const config: MutationConfig = {
      defaultEnabled: false,
      overrides: [
        { table: "users", enabled: true },
        { table: "audit_logs", enabled: false },
      ],
    };

    expect(config.overrides).toHaveLength(2);
    expect(config.overrides![0].table).toBe("users");
  });

  it("should accept complete CreateCollectionToolsConfig", () => {
    const config: CreateCollectionToolsConfig = {
      database: {
        type: "postgres",
        connectionString: "postgresql://localhost:5432/test",
      },
      collections: {
        mode: "exclude",
        tables: ["_internal"],
      },
      mutations: {
        defaultEnabled: true,
        overrides: [{ table: "audit_logs", enabled: false }],
      },
      cache: {
        ttl: 60000,
        enabled: true,
      },
    };

    expect(config.database.type).toBe("postgres");
    expect(config.collections?.mode).toBe("exclude");
    expect(config.mutations?.defaultEnabled).toBe(true);
    expect(config.cache?.ttl).toBe(60000);
  });

  it("should accept minimal CreateCollectionToolsConfig", () => {
    const config: CreateCollectionToolsConfig = {
      database: {
        type: "sqlite",
        filename: "./test.db",
      },
    };

    expect(config.database.type).toBe("sqlite");
    expect(config.collections).toBeUndefined();
    expect(config.mutations).toBeUndefined();
    expect(config.cache).toBeUndefined();
  });
});

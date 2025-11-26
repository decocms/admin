/**
 * Tests for Runtime Zod Schema Generator
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  generateSchemas,
  normalizeSqlType,
  detectAuditFields,
} from "../src/schema-generator";
import type { TableMetadata, ColumnMetadata } from "../src/types";

describe("normalizeSqlType", () => {
  it("should normalize string types", () => {
    expect(normalizeSqlType("VARCHAR")).toBe("string");
    expect(normalizeSqlType("TEXT")).toBe("string");
    expect(normalizeSqlType("CHAR(10)")).toBe("string");
    expect(normalizeSqlType("character varying")).toBe("string");
  });

  it("should normalize number types", () => {
    expect(normalizeSqlType("INTEGER")).toBe("number");
    expect(normalizeSqlType("BIGINT")).toBe("number");
    expect(normalizeSqlType("SMALLINT")).toBe("number");
    expect(normalizeSqlType("DECIMAL")).toBe("number");
    expect(normalizeSqlType("NUMERIC")).toBe("number");
    expect(normalizeSqlType("REAL")).toBe("number");
    expect(normalizeSqlType("FLOAT")).toBe("number");
    expect(normalizeSqlType("DOUBLE")).toBe("number");
    expect(normalizeSqlType("SERIAL")).toBe("number");
  });

  it("should normalize boolean types", () => {
    expect(normalizeSqlType("BOOLEAN")).toBe("boolean");
    expect(normalizeSqlType("BOOL")).toBe("boolean");
  });

  it("should normalize datetime types", () => {
    expect(normalizeSqlType("TIMESTAMP")).toBe("datetime");
    expect(normalizeSqlType("DATETIME")).toBe("datetime");
    expect(normalizeSqlType("TIMESTAMPTZ")).toBe("datetime");
  });

  it("should normalize date types", () => {
    expect(normalizeSqlType("DATE")).toBe("date");
  });

  it("should normalize time types", () => {
    expect(normalizeSqlType("TIME")).toBe("time");
  });

  it("should normalize json types", () => {
    expect(normalizeSqlType("JSON")).toBe("json");
    expect(normalizeSqlType("JSONB")).toBe("json");
  });

  it("should normalize binary types", () => {
    expect(normalizeSqlType("BLOB")).toBe("binary");
    expect(normalizeSqlType("BINARY")).toBe("binary");
    expect(normalizeSqlType("BYTEA")).toBe("binary");
  });

  it("should return unknown for unrecognized types", () => {
    expect(normalizeSqlType("GEOMETRY")).toBe("unknown");
    expect(normalizeSqlType("CUSTOM_TYPE")).toBe("unknown");
  });
});

describe("detectAuditFields", () => {
  it("should detect standard audit fields", () => {
    const columns: ColumnMetadata[] = [
      {
        name: "id",
        type: "string",
        rawType: "VARCHAR",
        nullable: false,
        isPrimaryKey: true,
        hasDefault: false,
        isAutoIncrement: false,
      },
      {
        name: "created_at",
        type: "datetime",
        rawType: "TIMESTAMP",
        nullable: false,
        isPrimaryKey: false,
        hasDefault: true,
        isAutoIncrement: false,
      },
      {
        name: "updated_at",
        type: "datetime",
        rawType: "TIMESTAMP",
        nullable: false,
        isPrimaryKey: false,
        hasDefault: true,
        isAutoIncrement: false,
      },
      {
        name: "created_by",
        type: "string",
        rawType: "VARCHAR",
        nullable: true,
        isPrimaryKey: false,
        hasDefault: false,
        isAutoIncrement: false,
      },
      {
        name: "updated_by",
        type: "string",
        rawType: "VARCHAR",
        nullable: true,
        isPrimaryKey: false,
        hasDefault: false,
        isAutoIncrement: false,
      },
    ];

    const auditFields = detectAuditFields(columns);

    expect(auditFields.createdAt).toBe("created_at");
    expect(auditFields.updatedAt).toBe("updated_at");
    expect(auditFields.createdBy).toBe("created_by");
    expect(auditFields.updatedBy).toBe("updated_by");
  });

  it("should detect camelCase audit fields", () => {
    const columns: ColumnMetadata[] = [
      {
        name: "id",
        type: "string",
        rawType: "VARCHAR",
        nullable: false,
        isPrimaryKey: true,
        hasDefault: false,
        isAutoIncrement: false,
      },
      {
        name: "createdAt",
        type: "datetime",
        rawType: "TIMESTAMP",
        nullable: false,
        isPrimaryKey: false,
        hasDefault: true,
        isAutoIncrement: false,
      },
      {
        name: "updatedAt",
        type: "datetime",
        rawType: "TIMESTAMP",
        nullable: false,
        isPrimaryKey: false,
        hasDefault: true,
        isAutoIncrement: false,
      },
    ];

    const auditFields = detectAuditFields(columns);

    expect(auditFields.createdAt).toBe("createdAt");
    expect(auditFields.updatedAt).toBe("updatedAt");
  });

  it("should return empty object when no audit fields present", () => {
    const columns: ColumnMetadata[] = [
      {
        name: "id",
        type: "string",
        rawType: "VARCHAR",
        nullable: false,
        isPrimaryKey: true,
        hasDefault: false,
        isAutoIncrement: false,
      },
      {
        name: "name",
        type: "string",
        rawType: "VARCHAR",
        nullable: false,
        isPrimaryKey: false,
        hasDefault: false,
        isAutoIncrement: false,
      },
    ];

    const auditFields = detectAuditFields(columns);

    expect(auditFields).toEqual({});
  });
});

describe("generateSchemas", () => {
  const mockTable: TableMetadata = {
    name: "users",
    columns: [
      {
        name: "id",
        type: "string",
        rawType: "VARCHAR",
        nullable: false,
        isPrimaryKey: true,
        hasDefault: false,
        isAutoIncrement: true,
      },
      {
        name: "email",
        type: "string",
        rawType: "VARCHAR",
        nullable: false,
        isPrimaryKey: false,
        hasDefault: false,
        isAutoIncrement: false,
      },
      {
        name: "age",
        type: "number",
        rawType: "INTEGER",
        nullable: true,
        isPrimaryKey: false,
        hasDefault: false,
        isAutoIncrement: false,
      },
      {
        name: "created_at",
        type: "datetime",
        rawType: "TIMESTAMP",
        nullable: false,
        isPrimaryKey: false,
        hasDefault: true,
        isAutoIncrement: false,
      },
      {
        name: "updated_at",
        type: "datetime",
        rawType: "TIMESTAMP",
        nullable: false,
        isPrimaryKey: false,
        hasDefault: true,
        isAutoIncrement: false,
      },
    ],
    primaryKey: "id",
    auditFields: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  };

  it("should generate entity schema with all columns", () => {
    const { entitySchema } = generateSchemas(mockTable);

    expect(entitySchema).toBeDefined();
    expect(entitySchema instanceof z.ZodObject).toBe(true);

    // Validate a valid entity
    const validEntity = {
      id: "123",
      email: "test@example.com",
      age: 25,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };

    const result = entitySchema.safeParse(validEntity);
    expect(result.success).toBe(true);
  });

  it("should generate insert schema without auto-increment primary key", () => {
    const { insertSchema } = generateSchemas(mockTable);

    // Insert schema should not have id (auto-increment)
    const validInsert = {
      email: "test@example.com",
      age: 25,
    };

    const result = insertSchema.safeParse(validInsert);
    expect(result.success).toBe(true);

    // Should not require audit fields (auto-populated)
    const withoutAudit = {
      email: "test@example.com",
    };
    expect(insertSchema.safeParse(withoutAudit).success).toBe(true);
  });

  it("should generate update schema with all fields optional", () => {
    const { updateSchema } = generateSchemas(mockTable);

    // All fields should be optional
    const partialUpdate = {
      email: "new@example.com",
    };

    const result = updateSchema.safeParse(partialUpdate);
    expect(result.success).toBe(true);

    // Empty update should be valid
    expect(updateSchema.safeParse({}).success).toBe(true);
  });

  it("should handle nullable fields correctly", () => {
    const { entitySchema } = generateSchemas(mockTable);

    // Age is nullable, should accept null
    const withNullAge = {
      id: "123",
      email: "test@example.com",
      age: null,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };

    const result = entitySchema.safeParse(withNullAge);
    expect(result.success).toBe(true);
  });

  it("should enforce non-nullable fields", () => {
    const { entitySchema } = generateSchemas(mockTable);

    // Email is not nullable
    const withNullEmail = {
      id: "123",
      email: null,
      age: 25,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };

    const result = entitySchema.safeParse(withNullEmail);
    expect(result.success).toBe(false);
  });
});

/**
 * Runtime Zod Schema Generator
 *
 * This module generates Zod schemas from database column metadata at runtime.
 * It maps SQL types to appropriate Zod types and handles nullable columns.
 */

import { z } from "zod";
import type {
  ColumnMetadata,
  GeneratedSchemas,
  SqlType,
  TableMetadata,
} from "./types";

/**
 * Map SQL type to Zod schema
 */
function sqlTypeToZod(column: ColumnMetadata): z.ZodTypeAny {
  let schema: z.ZodTypeAny;

  switch (column.type) {
    case "string":
      schema = z.string();
      break;
    case "number":
      schema = z.number();
      break;
    case "boolean":
      schema = z.boolean();
      break;
    case "datetime":
    case "date":
    case "time":
      schema = z.string().datetime();
      break;
    case "json":
      schema = z.unknown(); // JSON can be any valid JSON type
      break;
    case "binary":
      schema = z.instanceof(Buffer);
      break;
    case "unknown":
    default:
      schema = z.unknown();
      break;
  }

  // Add description with column information
  const description = `${column.name} (${column.rawType})`;
  schema = schema.describe(description);

  return schema;
}

/**
 * Create entity schema field with nullability handling
 */
function createEntityField(column: ColumnMetadata): z.ZodTypeAny {
  let schema = sqlTypeToZod(column);

  if (column.nullable) {
    schema = schema.nullable();
  }

  return schema;
}

/**
 * Create insert schema field (omit auto-generated fields)
 */
function createInsertField(column: ColumnMetadata): z.ZodTypeAny | null {
  // Skip auto-increment primary keys
  if (column.isPrimaryKey && column.isAutoIncrement) {
    return null;
  }

  let schema = sqlTypeToZod(column);

  // If column has a default value or is nullable, make it optional
  if (column.hasDefault || column.nullable) {
    schema = schema.optional();
  }

  return schema;
}

/**
 * Create update schema field (all optional except ID)
 */
function createUpdateField(column: ColumnMetadata): z.ZodTypeAny | null {
  // Skip primary key in updates
  if (column.isPrimaryKey) {
    return null;
  }

  let schema = sqlTypeToZod(column);

  // All fields are optional in updates
  if (column.nullable) {
    schema = schema.nullable();
  }
  schema = schema.optional();

  return schema;
}

/**
 * Generate Zod schemas for a table
 */
export function generateSchemas(table: TableMetadata): GeneratedSchemas {
  // Build entity schema (all columns)
  const entityShape: Record<string, z.ZodTypeAny> = {};
  for (const column of table.columns) {
    entityShape[column.name] = createEntityField(column);
  }
  const entitySchema = z.object(entityShape);

  // Build insert schema (omit auto-generated fields, make optional fields optional)
  const insertShape: Record<string, z.ZodTypeAny> = {};
  for (const column of table.columns) {
    // Skip audit timestamp fields - will be auto-populated
    if (
      column.name === table.auditFields.createdAt ||
      column.name === table.auditFields.updatedAt
    ) {
      continue;
    }

    const field = createInsertField(column);
    if (field !== null) {
      insertShape[column.name] = field;
    }
  }
  const insertSchema = z.object(insertShape);

  // Build update schema (all optional except ID)
  const updateShape: Record<string, z.ZodTypeAny> = {};
  for (const column of table.columns) {
    // Skip audit timestamp fields - will be auto-populated
    if (
      column.name === table.auditFields.createdAt ||
      column.name === table.auditFields.updatedAt
    ) {
      continue;
    }

    const field = createUpdateField(column);
    if (field !== null) {
      updateShape[column.name] = field;
    }
  }
  const updateSchema = z.object(updateShape);

  return {
    entitySchema,
    insertSchema,
    updateSchema,
  };
}

/**
 * Normalize SQL type from raw database type string
 */
export function normalizeSqlType(rawType: string): SqlType {
  const lower = rawType.toLowerCase();

  // String types
  if (
    lower.includes("char") ||
    lower.includes("text") ||
    lower.includes("string") ||
    lower.includes("clob")
  ) {
    return "string";
  }

  // Number types
  if (
    lower.includes("int") ||
    lower.includes("serial") ||
    lower.includes("numeric") ||
    lower.includes("decimal") ||
    lower.includes("real") ||
    lower.includes("float") ||
    lower.includes("double")
  ) {
    return "number";
  }

  // Boolean types
  if (lower.includes("bool")) {
    return "boolean";
  }

  // DateTime types
  if (
    lower.includes("timestamp") ||
    lower.includes("datetime") ||
    lower === "timestamptz"
  ) {
    return "datetime";
  }

  // Date types
  if (lower.includes("date")) {
    return "date";
  }

  // Time types
  if (lower.includes("time")) {
    return "time";
  }

  // JSON types
  if (lower.includes("json")) {
    return "json";
  }

  // Binary types
  if (
    lower.includes("blob") ||
    lower.includes("binary") ||
    lower.includes("bytea")
  ) {
    return "binary";
  }

  return "unknown";
}

/**
 * Detect audit fields from column names
 */
export function detectAuditFields(
  columns: ColumnMetadata[],
): TableMetadata["auditFields"] {
  const auditFields: TableMetadata["auditFields"] = {};

  for (const column of columns) {
    const name = column.name.toLowerCase();

    if (name === "created_at" || name === "createdat") {
      auditFields.createdAt = column.name;
    } else if (name === "updated_at" || name === "updatedat") {
      auditFields.updatedAt = column.name;
    } else if (name === "created_by" || name === "createdby") {
      auditFields.createdBy = column.name;
    } else if (name === "updated_by" || name === "updatedby") {
      auditFields.updatedBy = column.name;
    }
  }

  return auditFields;
}

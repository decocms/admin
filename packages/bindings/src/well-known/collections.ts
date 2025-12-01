import { z } from "zod/v3";
import type { ToolBinder } from "../core/binder";

/**
 * Collection Bindings - Standardized CRUD + Search operations for SQL table-like structures
 */

/** Base schema for collection entities */
export const BaseCollectionEntitySchema = z.object({
  id: z.string().describe("Unique identifier for the entity"),
  title: z.string().describe("Human-readable title for the entity"),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  created_by: z.string().optional(),
  updated_by: z.string().optional(),
});

const ComparisonExpressionSchema = z.object({
  field: z.array(z.string()),
  operator: z.enum(["eq", "gt", "gte", "lt", "lte", "in", "like", "contains"]),
  value: z.unknown(),
});

export const WhereExpressionSchema = z.union([
  ComparisonExpressionSchema,
  z.object({
    operator: z.enum(["and", "or", "not"]),
    conditions: z.array(ComparisonExpressionSchema),
  }),
]);

export const OrderByExpressionSchema = z.object({
  field: z.array(z.string()),
  direction: z.enum(["asc", "desc"]),
  nulls: z.enum(["first", "last"]).optional(),
});

export const CollectionListInputSchema = z.object({
  where: WhereExpressionSchema.optional().describe("Filter expression"),
  orderBy: z
    .array(OrderByExpressionSchema)
    .optional()
    .describe("Sort expressions"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .describe("Maximum number of items to return"),
  offset: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Number of items to skip"),
});

export const CollectionGetInputSchema = z.object({
  id: z.string().describe("ID of the entity to retrieve"),
});

export const CollectionDeleteInputSchema = z.object({
  id: z.string().describe("ID of the entity to delete"),
});

export interface CollectionBindingOptions {
  readOnly?: boolean;
}

/**
 * Creates collection bindings for CRUD + Query operations
 *
 * @example
 * const USER_COLLECTION = createCollectionBindings("users", UserSchema);
 * const READONLY_COLLECTION = createCollectionBindings("products", ProductSchema, { readOnly: true });
 */
export function createCollectionBindings(
  collectionName: string,
  entitySchema: z.ZodObject<z.ZodRawShape>,
  options?: CollectionBindingOptions,
): ToolBinder[] {
  const upperName = collectionName.toUpperCase();
  const readOnly = options?.readOnly ?? false;

  const bindings: ToolBinder[] = [
    {
      name: `COLLECTION_${upperName}_LIST`,
      inputSchema: CollectionListInputSchema,
      outputSchema: z.object({
        items: z.array(entitySchema).describe("Array of collection items"),
        totalCount: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Total number of matching items"),
        hasMore: z
          .boolean()
          .optional()
          .describe("Whether there are more items available"),
      }),
    },
    {
      name: `COLLECTION_${upperName}_GET`,
      inputSchema: CollectionGetInputSchema,
      outputSchema: z.object({
        item: entitySchema
          .nullable()
          .describe("The retrieved item, or null if not found"),
      }),
    },
  ];

  if (!readOnly) {
    bindings.push(
      {
        name: `COLLECTION_${upperName}_CREATE`,
        inputSchema: z.object({
          data: entitySchema.describe(
            "Data for the new entity (id may be auto-generated)",
          ),
        }),
        outputSchema: z.object({
          item: entitySchema
            .nullable()
            .describe("The retrieved item, or null if not found"),
        }),
        opt: true,
      },
      {
        name: `COLLECTION_${upperName}_UPDATE`,
        inputSchema: z.object({
          id: z.string().describe("ID of the entity to update"),
          data: (entitySchema as z.AnyZodObject)
            .partial()
            .describe("Partial entity data to update"),
        }),
        outputSchema: z.object({
          item: entitySchema.describe("The updated entity"),
        }),
        opt: true,
      },
      {
        name: `COLLECTION_${upperName}_DELETE`,
        inputSchema: CollectionDeleteInputSchema,
        outputSchema: z.object({
          item: entitySchema.describe("The deleted entity"),
        }),
        opt: true,
      },
    );
  }

  return bindings;
}

// Exported types
export type CollectionListOutput<T> = {
  items: T[];
  totalCount?: number;
  hasMore?: boolean;
};
export type CollectionGetOutput<T> = { item: T | null };
export type CollectionInsertOutput<T> = { item: T };
export type CollectionUpdateOutput<T> = { item: T };
export type CollectionDeleteOutput<T> = { item: T };

/**
 * Tool Factory
 *
 * Main function to create collection tools from database schema.
 * Uses lazy introspection with SWR caching and generates tools dynamically.
 */

import { createPrivateTool } from "@decocms/runtime/mastra";
import {
  CollectionListInputSchema,
  CollectionGetInputSchema,
  CollectionDeleteInputSchema,
  CollectionDeleteOutputSchema,
  createCollectionListOutputSchema,
  createCollectionGetOutputSchema,
  createCollectionInsertInputSchema,
  createCollectionInsertOutputSchema,
  createCollectionUpdateInputSchema,
  createCollectionUpdateOutputSchema,
} from "@decocms/bindings/collections";
import type {
  CollectionToolsOptions,
  DatabaseAdapter,
  DatabaseConfig,
  TableMetadata,
} from "./types";
import { PostgresAdapter } from "./implementations/postgres";
import { SqliteAdapter } from "./implementations/sqlite";
import { generateSchemas } from "./schema-generator";
import { getGlobalCache } from "./cache";

/**
 * Create database adapter from configuration
 * Exported as a convenience helper
 */
export async function createAdapter(
  config: DatabaseConfig,
): Promise<DatabaseAdapter> {
  switch (config.type) {
    case "postgres":
      return new PostgresAdapter(config);
    case "sqlite": {
      // Use Bun's native SQLite in Bun runtime, otherwise use better-sqlite3
      const isBun = typeof Bun !== "undefined";
      if (isBun) {
        const { BunSqliteAdapter } = await import(
          "./implementations/bun-sqlite"
        );
        return new BunSqliteAdapter(config);
      }
      return new SqliteAdapter(config);
    }
    default:
      throw new Error(
        `Unsupported database type: ${(config as { type: string }).type}`,
      );
  }
}

/**
 * Filter tables based on collection configuration
 */
function filterTables(
  tables: TableMetadata[],
  options: CollectionToolsOptions,
): TableMetadata[] {
  const collectionConfig = options.collections ?? { mode: "all" };

  switch (collectionConfig.mode) {
    case "all":
      return tables;
    case "include":
      if (!collectionConfig.tables || collectionConfig.tables.length === 0) {
        return [];
      }
      return tables.filter((t) => collectionConfig.tables!.includes(t.name));
    case "exclude":
      if (!collectionConfig.tables || collectionConfig.tables.length === 0) {
        return tables;
      }
      return tables.filter((t) => !collectionConfig.tables!.includes(t.name));
    default:
      return tables;
  }
}

/**
 * Check if mutations are enabled for a table
 */
function isMutationEnabled(
  tableName: string,
  options: CollectionToolsOptions,
): boolean {
  const mutationConfig = options.mutations ?? { defaultEnabled: false };
  const defaultEnabled = mutationConfig.defaultEnabled ?? false;

  // Check for table-specific override
  if (mutationConfig.overrides) {
    const override = mutationConfig.overrides.find(
      (o) => o.table === tableName,
    );
    if (override) {
      return override.enabled;
    }
  }

  return defaultEnabled;
}

/**
 * Get authenticated user ID from context
 */
function getUserId(context: {
  runtimeContext?: { get: (key: string) => unknown };
}): string | undefined {
  try {
    const env = context.runtimeContext?.get("env") as
      | {
          DECO_REQUEST_CONTEXT?: { ensureAuthenticated: () => { id?: string } };
        }
      | undefined;
    if (env?.DECO_REQUEST_CONTEXT) {
      const auth = env.DECO_REQUEST_CONTEXT.ensureAuthenticated();
      return auth?.id;
    }
  } catch {
    // User not authenticated or context not available
    return undefined;
  }
  return undefined;
}

/**
 * Create LIST tool for a table
 */
function createListTool(
  table: TableMetadata,
  adapter: DatabaseAdapter,
  schemas: ReturnType<typeof generateSchemas>,
) {
  const toolName = `DECO_COLLECTION_${table.name.toUpperCase()}_LIST`;

  return createPrivateTool({
    id: toolName,
    description: `Query and list ${table.name} with filtering, sorting, and pagination`,
    inputSchema: CollectionListInputSchema,
    outputSchema: createCollectionListOutputSchema(schemas.entitySchema),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute: async (context: any) => {
      const { where, orderBy, limit, offset } = context.data;

      const items = await adapter.query(
        table.name,
        {
          where,
          orderBy,
          limit,
          offset,
        },
        context,
      );

      return {
        items,
        totalCount: items.length,
        hasMore: limit ? items.length >= limit : false,
      };
    },
  });
}

/**
 * Create GET tool for a table
 */
function createGetTool(
  table: TableMetadata,
  adapter: DatabaseAdapter,
  schemas: ReturnType<typeof generateSchemas>,
) {
  const toolName = `DECO_COLLECTION_${table.name.toUpperCase()}_GET`;

  if (!table.primaryKey) {
    throw new Error(`Table ${table.name} has no primary key`);
  }

  return createPrivateTool({
    id: toolName,
    description: `Get a single ${table.name} by ID`,
    inputSchema: CollectionGetInputSchema,
    outputSchema: createCollectionGetOutputSchema(schemas.entitySchema),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute: async (context: any) => {
      const { id } = context.data;

      const item = await adapter.getById(
        table.name,
        id,
        table.primaryKey!,
        context,
      );

      return { item };
    },
  });
}

/**
 * Create INSERT tool for a table
 */
function createInsertTool(
  table: TableMetadata,
  adapter: DatabaseAdapter,
  schemas: ReturnType<typeof generateSchemas>,
) {
  const toolName = `DECO_COLLECTION_${table.name.toUpperCase()}_CREATE`;

  return createPrivateTool({
    id: toolName,
    description: `Create a new ${table.name}`,
    inputSchema: createCollectionInsertInputSchema(schemas.insertSchema),
    outputSchema: createCollectionInsertOutputSchema(schemas.entitySchema),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute: async (context: any) => {
      const { data } = context.data;
      const userId = getUserId(context);

      // Auto-populate audit fields
      const now = new Date().toISOString();
      const insertData = { ...data };

      if (table.auditFields.createdAt) {
        insertData[table.auditFields.createdAt] = now;
      }
      if (table.auditFields.updatedAt) {
        insertData[table.auditFields.updatedAt] = now;
      }
      if (table.auditFields.createdBy && userId) {
        insertData[table.auditFields.createdBy] = userId;
      }
      if (table.auditFields.updatedBy && userId) {
        insertData[table.auditFields.updatedBy] = userId;
      }

      const item = await adapter.insert(table.name, insertData, context);

      return { item };
    },
  });
}

/**
 * Create UPDATE tool for a table
 */
function createUpdateTool(
  table: TableMetadata,
  adapter: DatabaseAdapter,
  schemas: ReturnType<typeof generateSchemas>,
) {
  const toolName = `DECO_COLLECTION_${table.name.toUpperCase()}_UPDATE`;

  if (!table.primaryKey) {
    throw new Error(`Table ${table.name} has no primary key`);
  }

  return createPrivateTool({
    id: toolName,
    description: `Update an existing ${table.name}`,
    inputSchema: createCollectionUpdateInputSchema(schemas.entitySchema),
    outputSchema: createCollectionUpdateOutputSchema(schemas.entitySchema),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute: async (context: any) => {
      const { id, data } = context.data;
      const userId = getUserId(context);

      // Auto-populate audit fields
      const updateData = { ...data };

      if (table.auditFields.updatedAt) {
        updateData[table.auditFields.updatedAt] = new Date().toISOString();
      }
      if (table.auditFields.updatedBy && userId) {
        updateData[table.auditFields.updatedBy] = userId;
      }

      const item = await adapter.update(
        table.name,
        id,
        table.primaryKey!,
        updateData,
        context,
      );

      return { item };
    },
  });
}

/**
 * Create DELETE tool for a table
 */
function createDeleteTool(table: TableMetadata, adapter: DatabaseAdapter) {
  const toolName = `DECO_COLLECTION_${table.name.toUpperCase()}_DELETE`;

  if (!table.primaryKey) {
    throw new Error(`Table ${table.name} has no primary key`);
  }

  return createPrivateTool({
    id: toolName,
    description: `Delete a ${table.name} by ID`,
    inputSchema: CollectionDeleteInputSchema,
    outputSchema: CollectionDeleteOutputSchema,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute: async (context: any) => {
      const { id } = context.data;

      const success = await adapter.delete(
        table.name,
        id,
        table.primaryKey!,
        context,
      );

      return { success, id };
    },
  });
}

/**
 * Create all collection tools from a database adapter
 *
 * This function:
 * 1. Introspects the database schema (with SWR caching)
 * 2. Filters tables based on collection configuration
 * 3. Generates tools for each table (LIST, GET, CREATE, UPDATE, DELETE)
 * 4. Returns an array of tools that can be registered with an MCP server
 *
 * @param adapter - Database adapter instance
 * @param options - Optional configuration for collections, mutations, and cache
 * @returns Promise<ReturnType<typeof createPrivateTool>[]> - Array of collection tools
 *
 * @example
 * ```typescript
 * // With PostgreSQL adapter
 * const adapter = new PostgresAdapter({
 *   connectionString: 'postgresql://localhost/mydb',
 *   schema: 'public'
 * });
 *
 * const tools = await createCollectionTools(adapter, {
 *   collections: {
 *     mode: 'include',
 *     tables: ['users', 'posts']
 *   },
 *   mutations: {
 *     defaultEnabled: true
 *   }
 * });
 *
 * // With SQLite adapter
 * const sqliteAdapter = new SqliteAdapter({ filename: './data.db' });
 * const tools = await createCollectionTools(sqliteAdapter);
 *
 * // With custom adapter implementation
 * class MyCustomAdapter implements DatabaseAdapter {
 *   async introspect() { ... }
 *   // ... implement other methods
 * }
 * const customAdapter = new MyCustomAdapter();
 * const tools = await createCollectionTools(customAdapter);
 * ```
 */
export async function createCollectionTools(
  adapter: DatabaseAdapter,
  options: CollectionToolsOptions = {},
): Promise<ReturnType<typeof createPrivateTool>[]> {
  // Get cache configuration
  const cacheConfig = options.cache ?? { ttl: 60000, enabled: true };
  const cacheEnabled = cacheConfig.enabled ?? true;

  // Introspect database schema with caching
  let tables: TableMetadata[];

  if (cacheEnabled) {
    const cache = getGlobalCache(cacheConfig.ttl);
    // For custom adapters, use a stable cache key based on constructor name
    const cacheKey = `${adapter.constructor.name}`;

    tables = await cache.getOrFetch(
      "custom",
      cacheKey,
      () => adapter.introspect(),
      undefined,
    );
  } else {
    tables = await adapter.introspect();
  }

  // Filter tables
  const filteredTables = filterTables(tables, options);

  // Generate tools for each table
  const tools: ReturnType<typeof createPrivateTool>[] = [];

  for (const table of filteredTables) {
    // Skip tables without primary keys
    if (!table.primaryKey) {
      console.warn(`Skipping table ${table.name}: no primary key found`);
      continue;
    }

    // Generate schemas
    const schemas = generateSchemas(table);

    // Always create LIST and GET tools
    tools.push(createListTool(table, adapter, schemas));
    tools.push(createGetTool(table, adapter, schemas));

    // Create mutation tools if enabled
    if (isMutationEnabled(table.name, options)) {
      tools.push(createInsertTool(table, adapter, schemas));
      tools.push(createUpdateTool(table, adapter, schemas));
      tools.push(createDeleteTool(table, adapter));
    }
  }

  return tools;
}

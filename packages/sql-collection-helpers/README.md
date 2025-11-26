# @decocms/sql-collection-helpers

Dynamic MCP tool generation from SQL database schemas with support for PostgreSQL and SQLite.

## Features

- 🔍 **Auto-discovery**: Automatically introspect database schemas and generate collection tools
- 🔄 **SWR Caching**: Stale-while-revalidate caching for fast performance with fresh data
- 🔒 **Authentication**: Built-in authentication using `createPrivateTool`
- 📝 **Audit Fields**: Automatic population of `created_at`, `updated_at`, `created_by`, `updated_by`
- 🎯 **Type Safety**: Runtime Zod schema generation from database metadata
- 🎨 **Flexible Configuration**: Per-table mutation control, table filtering, and more
- 🗄️ **Multi-Database**: PostgreSQL and SQLite support with unified API
- ⚡ **Runtime-Aware**: Automatically uses Bun's native SQLite in Bun runtime, `better-sqlite3` in Node.js

## Installation

```bash
npm install @decocms/sql-collection-helpers
```

## Quick Start

### PostgreSQL Example

```typescript
import { createCollectionTools } from '@decocms/sql-collection-helpers';

// Generate tools for all tables in a PostgreSQL database
const tools = await createCollectionTools({
  database: {
    type: 'postgres',
    connectionString: process.env.DATABASE_URL!,
    schema: 'public' // optional, defaults to 'public'
  }
});

// Register tools with your MCP server
// Each table gets 5 tools: LIST, GET, CREATE, UPDATE, DELETE
```

### SQLite Example

```typescript
import { createCollectionTools } from '@decocms/sql-collection-helpers';

// Generate tools for specific tables in a SQLite database
const tools = await createCollectionTools({
  database: {
    type: 'sqlite',
    filename: './data.db'
  },
  collections: {
    mode: 'include',
    tables: ['users', 'posts', 'comments']
  },
  mutations: {
    defaultEnabled: true,
    overrides: [
      { table: 'users', enabled: false } // Read-only for users table
    ]
  }
});
```

## Configuration

### Database Configuration

#### PostgreSQL

```typescript
{
  type: 'postgres',
  connectionString: 'postgresql://user:pass@localhost:5432/mydb',
  schema?: 'public' // Optional, defaults to 'public'
}
```

#### SQLite

```typescript
{
  type: 'sqlite',
  filename: './database.db' // or ':memory:' for in-memory
}
```

### Collection Configuration

Control which tables are exposed as collections:

```typescript
// Export all tables (default)
collections: {
  mode: 'all'
}

// Export only specific tables
collections: {
  mode: 'include',
  tables: ['users', 'posts']
}

// Export all tables except specific ones
collections: {
  mode: 'exclude',
  tables: ['_internal', 'migrations']
}
```

### Mutation Configuration

Control which tables allow mutations (CREATE/UPDATE/DELETE):

```typescript
mutations: {
  defaultEnabled: false, // Default for all tables
  overrides: [
    { table: 'posts', enabled: true },    // Allow mutations
    { table: 'users', enabled: false }    // Read-only
  ]
}
```

### Cache Configuration

Configure SWR caching behavior:

```typescript
cache: {
  ttl: 60000,        // Time-to-live in milliseconds (default: 60s)
  enabled: true      // Enable/disable caching (default: true)
}
```

## Generated Tools

For each table, up to 5 tools are generated:

### Always Generated

1. **`DECO_COLLECTION_{TABLE}_LIST`** - Query with filtering, sorting, pagination
2. **`DECO_COLLECTION_{TABLE}_GET`** - Get single item by ID

### Conditionally Generated (if mutations enabled)

3. **`DECO_COLLECTION_{TABLE}_CREATE`** - Insert new record
4. **`DECO_COLLECTION_{TABLE}_UPDATE`** - Update existing record
5. **`DECO_COLLECTION_{TABLE}_DELETE`** - Delete record

### Tool Input/Output

All tools follow the [Collection Binding specification](../bindings/src/well-known/collections.ts):

```typescript
// LIST
Input: { where?, orderBy?, limit?, offset? }
Output: { items: T[], totalCount?, hasMore? }

// GET
Input: { id: string }
Output: { item: T | null }

// CREATE
Input: { data: Partial<T> }
Output: { item: T }

// UPDATE
Input: { id: string, data: Partial<T> }
Output: { item: T }

// DELETE
Input: { id: string }
Output: { success: boolean, id: string }
```

## Audit Fields

The package automatically detects and populates audit fields:

- `created_at` / `createdAt` - Set on INSERT
- `updated_at` / `updatedAt` - Set on INSERT and UPDATE
- `created_by` / `createdBy` - Set to authenticated user ID on INSERT
- `updated_by` / `updatedBy` - Set to authenticated user ID on UPDATE

## Type Mapping

### PostgreSQL → Zod

- `text`, `varchar`, `char` → `z.string()`
- `integer`, `bigint`, `smallint`, `numeric`, `decimal` → `z.number()`
- `boolean` → `z.boolean()`
- `timestamp`, `timestamptz` → `z.string().datetime()`
- `date` → `z.string().date()`
- `json`, `jsonb` → `z.unknown()`
- `bytea` → `z.instanceof(Buffer)`

### SQLite → Zod

- `TEXT` → `z.string()`
- `INTEGER`, `REAL`, `NUMERIC` → `z.number()`
- `BLOB` → `z.instanceof(Buffer)`

## Advanced Usage

### Using Adapters Directly

You can also use the adapters directly if you need more control:

```typescript
import { 
  PostgresAdapter, 
  SqliteAdapter,        // Node.js
  BunSqliteAdapter      // Bun
} from '@decocms/sql-collection-helpers';

// PostgreSQL
const pgAdapter = new PostgresAdapter({
  type: 'postgres',
  connectionString: 'postgresql://localhost/mydb',
  schema: 'public'
});

// SQLite in Node.js
const nodeAdapter = new SqliteAdapter({
  type: 'sqlite',
  filename: './data.db'
});

// SQLite in Bun
const bunAdapter = new BunSqliteAdapter({
  type: 'sqlite',
  filename: './data.db'
});

// All adapters implement the same DatabaseAdapter interface
const tables = await pgAdapter.introspect();
const results = await pgAdapter.query('users', { limit: 10 });
```

### Custom Adapter

You can create your own adapter by implementing the `DatabaseAdapter` interface:

```typescript
import { DatabaseAdapter, TableMetadata, QueryParams } from '@decocms/sql-collection-helpers';

class MyCustomAdapter implements DatabaseAdapter {
  async introspect(): Promise<TableMetadata[]> {
    // Your introspection logic
  }

  async query(table: string, params: QueryParams): Promise<Record<string, unknown>[]> {
    // Your query logic
  }

  // ... implement other methods
}
```

### Programmatic Schema Access

```typescript
import { generateSchemas, normalizeSqlType } from '@decocms/sql-collection-helpers';

// Generate Zod schemas from table metadata
const schemas = generateSchemas(tableMetadata);

// Access individual schemas
schemas.entitySchema;  // Full entity schema
schemas.insertSchema;  // Schema for INSERT (omits auto-generated fields)
schemas.updateSchema;  // Schema for UPDATE (all fields optional)
```

### Cache Management

```typescript
import { getGlobalCache, resetGlobalCache } from '@decocms/sql-collection-helpers';

// Get cache instance
const cache = getGlobalCache();

// Clear specific entry
cache.clearEntry('postgres', 'postgresql://...', 'public');

// Clear all cached data
cache.clear();

// Reset cache instance
resetGlobalCache();
```

## Database Implementations

This package provides **three separate database implementations**, all implementing the same `DatabaseAdapter` interface:

### 1. PostgreSQL Adapter (`PostgresAdapter`)
- **Driver**: `postgres` package (raw SQL driver)
- **Usage**: Automatically used for `{ type: 'postgres' }` config
- **Features**: Full support for schemas, parameterized queries, RETURNING clauses

### 2. SQLite Adapter for Node.js (`SqliteAdapter`)
- **Driver**: `better-sqlite3` package
- **Usage**: Automatically used for `{ type: 'sqlite' }` config in Node.js runtime
- **Features**: Synchronous API, excellent performance, native bindings

### 3. SQLite Adapter for Bun (`BunSqliteAdapter`)
- **Driver**: `bun:sqlite` (Bun's native SQLite)
- **Usage**: **Automatically used** for `{ type: 'sqlite' }` config when running in Bun runtime
- **Features**: Native Bun integration, no external dependencies, zero-copy operations

> **Note**: The correct SQLite implementation is automatically selected at runtime based on the environment. You don't need to choose manually - just use `{ type: 'sqlite' }` and the package handles the rest!

## Requirements

- Node.js >= 24.0.0 **or** Bun >= 1.0.0
- PostgreSQL >= 9.6 (for PostgreSQL support)
- SQLite >= 3.35 (for RETURNING support in UPDATE/DELETE)

## License

MIT

## Related Packages

- [@decocms/bindings](../bindings) - Collection binding specifications
- [@decocms/runtime](../runtime) - Runtime utilities including `createPrivateTool`


# Drizzle Adapter Example

The Drizzle adapter supports lazy initialization, making it perfect for serverless environments where the database client needs access to environment variables at runtime.

## Basic Usage

```typescript
import { DrizzleAdapter } from "@decocms/sql-collection-helpers";
import { drizzle } from "@decocms/runtime/drizzle";
import type { DefaultEnv } from "@decocms/runtime";

// Create adapter with a factory function
const adapter = new DrizzleAdapter((context) => {
  // Get env from runtime context
  const env = context.runtimeContext?.get("env") as DefaultEnv | undefined;
  
  if (!env?.DECO_WORKSPACE_DB) {
    throw new Error("DECO_WORKSPACE_DB not available in env");
  }

  // Create Drizzle client lazily
  return drizzle({ DECO_WORKSPACE_DB: env.DECO_WORKSPACE_DB });
});

// Create collection tools
import { createCollectionTools } from "@decocms/sql-collection-helpers";

const tools = await createCollectionTools(adapter, {
  collections: {
    mode: "include",
    tables: ["users", "posts"],
  },
  mutations: {
    defaultEnabled: true,
  },
});
```

## How It Works

1. **Lazy Initialization**: The database client is created on-demand when tools execute
2. **Context Access**: The factory function receives the execution context which contains `env`
3. **No Upfront Connection**: No database connection is made during adapter creation
4. **Runtime Environment**: Works perfectly in edge/serverless environments where env is only available at runtime

## Key Differences from Other Adapters

### PostgreSQL/SQLite Adapters (Eager Initialization)
```typescript
// Client created immediately
const adapter = new PostgresAdapter({
  connectionString: process.env.DATABASE_URL!
});
```

### Drizzle Adapter (Lazy Initialization)
```typescript
// Client created when tools execute
const adapter = new DrizzleAdapter((context) => {
  const env = context.runtimeContext?.get("env");
  return drizzle({ DECO_WORKSPACE_DB: env.DECO_WORKSPACE_DB });
});
```

## Integration with MCP Server

```typescript
import { createMCPServer } from "@decocms/runtime/mastra";
import { DrizzleAdapter, createCollectionTools } from "@decocms/sql-collection-helpers";
import { drizzle } from "@decocms/runtime/drizzle";

export default createMCPServer({
  name: "my-collections-server",
  version: "1.0.0",
  
  async tools(env) {
    // Create Drizzle adapter with factory
    const adapter = new DrizzleAdapter((context) => {
      const runtimeEnv = context.runtimeContext?.get("env") as typeof env;
      return drizzle({ DECO_WORKSPACE_DB: runtimeEnv.DECO_WORKSPACE_DB });
    });

    // Generate collection tools
    return await createCollectionTools(adapter, {
      mutations: { defaultEnabled: true },
    });
  },
});
```

## Custom Adapter Implementation

You can also create your own adapter that implements the `DatabaseAdapter` interface:

```typescript
import type { DatabaseAdapter } from "@decocms/sql-collection-helpers";

class MyCustomAdapter implements DatabaseAdapter {
  constructor(private factory: () => MyDbClient) {}

  async introspect() {
    const db = this.factory();
    // ... introspection logic
  }

  async query(table, params, context) {
    const db = this.factory();
    // ... query logic with access to context
  }

  // ... implement other methods
}

const adapter = new MyCustomAdapter(() => createMyDbClient());
const tools = await createCollectionTools(adapter);
```

## SQL Injection Protection

The Drizzle adapter includes all the same SQL injection protections as other adapters:

- ✅ Table name validation
- ✅ Column name validation against schema
- ✅ ORDER BY field and direction sanitization
- ✅ WHERE clause field validation
- ✅ Parameterized queries for all values

See the main README for details on security features.


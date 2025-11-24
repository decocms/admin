# Collection Hooks - Implementation Summary

## Overview

This folder contains a complete implementation of React hooks for working with collections through MCP connections, inspired by [TanStack DB collection patterns](https://tanstack.com/db/latest/docs/collections/query-collection).

## Files Created

### Core Hooks

1. **`use-collection-query.ts`** - Query collection lists with filtering, sorting, and pagination
2. **`use-collection-item.ts`** - Query single collection items by ID
3. **`use-collection-mutations.ts`** - Create, update, delete, and batch operations

### Specialized Hooks

4. **`use-models-collection.ts`** - Domain-specific hook for the MODELS collection with automatic transformation
5. **`use-connection-collections.ts`** - Discover available collections on a connection

### Utilities

6. **`types.ts`** - TypeScript type definitions for all hooks
7. **`utils.ts`** - Helper functions for query keys, tool names, and option formatting

### Documentation

8. **`README.md`** - Main documentation with API reference
9. **`EXAMPLES.md`** - 10 complete real-world examples
10. **`MIGRATION_EXAMPLE.md`** - Migration guide from manual queries
11. **`index.ts`** - Barrel export for easy importing

## Key Features

### 1. Unified API

All collection interactions follow the same pattern:

```tsx
const { data, isLoading } = useCollectionQuery({
  connectionId: "conn_123",
  collectionName: "MODELS",
});
```

### 2. Type Safety

Fully typed with TypeScript generics:

```tsx
interface Model {
  id: string;
  title: string;
}

const query = useCollectionQuery<Model>({
  connectionId: "conn_123",
  collectionName: "MODELS",
});
// query.data.items is typed as Model[]
```

### 3. Automatic Cache Management

Query keys are automatically generated and invalidated:

```tsx
// Query key: [connectionId, "collection", "MODELS", "list"]
const query = useCollectionQuery({ ... });

// Mutations automatically invalidate the right queries
const { createItem } = useCollectionMutations({
  invalidateOnSuccess: true, // default
});
```

### 4. Filtering and Sorting

Built-in support for predicate push-down:

```tsx
const query = useCollectionQuery({
  connectionId: "conn_123",
  collectionName: "MESSAGES",
  queryOptions: {
    where: [
      { field: "status", operator: "eq", value: "active" }
    ],
    orderBy: [
      { field: "createdAt", direction: "desc" }
    ],
    limit: 50,
  },
});
```

### 5. Pagination Support

Both offset-based and cursor-based pagination:

```tsx
// Offset-based
const query = useCollectionQuery({
  queryOptions: {
    limit: 50,
    offset: page * 50,
  },
});

// Cursor-based
const query = useCollectionQuery({
  queryOptions: {
    limit: 50,
    cursor: nextCursor,
  },
});
```

### 6. Specialized Hooks

Domain-specific hooks with built-in transformations:

```tsx
const { models, isLoading } = useModelsCollection({
  connectionId: "conn_123",
});
// Models are automatically transformed for UI consumption
```

### 7. Collection Discovery

Discover what collections are available:

```tsx
const { data: collections } = useConnectionCollections({
  connectionId: "conn_123",
});
// Returns: [{ name: "MODELS", operations: { list: true, ... } }]
```

## Tool Naming Convention

Collections follow the `DECO_COLLECTION_{NAME}_{OPERATION}` pattern:

- `DECO_COLLECTION_MODELS_LIST` - List items
- `DECO_COLLECTION_MODELS_GET` - Get single item
- `DECO_COLLECTION_MODELS_CREATE` - Create item
- `DECO_COLLECTION_MODELS_UPDATE` - Update item
- `DECO_COLLECTION_MODELS_DELETE` - Delete item
- `DECO_COLLECTION_MODELS_BATCH` - Batch operations

## Query Key Structure

```
[connectionId, "collection", collectionName, "list", queryOptions?, ...additionalParts]
[connectionId, "collection", collectionName, "item", id]
```

## Usage Examples

### Basic Query

```tsx
import { useCollectionQuery } from "@/web/hooks/collections";

const { data, isLoading } = useCollectionQuery({
  connectionId: connection.id,
  collectionName: "MODELS",
});
```

### With Filters

```tsx
const query = useCollectionQuery({
  connectionId: connection.id,
  collectionName: "MESSAGES",
  queryOptions: {
    where: [{ field: "status", operator: "eq", value: "active" }],
  },
});
```

### Mutations

```tsx
import { useCollectionMutations } from "@/web/hooks/collections";

const { createItem, updateItem, deleteItem } = useCollectionMutations({
  connectionId: connection.id,
  collectionName: "MODELS",
});

await createItem.mutateAsync({
  item: { id: "model-1", title: "My Model" },
});
```

### Specialized Hook

```tsx
import { useModelsCollection } from "@/web/hooks/collections";

const { models, isLoading } = useModelsCollection({
  connectionId: connection.id,
});
// models are automatically transformed with logos, costs, etc.
```

## Migration Path

The hooks are designed to be a drop-in replacement for manual collection queries:

**Before:**
```tsx
const query = useQuery({
  queryKey: KEYS.modelsList(orgSlug),
  queryFn: async () => {
    const callTool = createConnectionToolCaller(connection.id);
    const result = await callTool("DECO_COLLECTION_MODELS_LIST", {});
    return { models: result?.items ?? [] };
  },
});
```

**After:**
```tsx
const query = useCollectionQuery({
  connectionId: connection.id,
  collectionName: "MODELS",
});
// Access via query.data.items
```

## Benefits

1. ✅ **Less Boilerplate** - No manual tool callers or error handling
2. ✅ **Type Safety** - Fully typed with generics
3. ✅ **Consistent Caching** - Automatic query key generation
4. ✅ **Built-in Transformations** - Use `select` for data transformations
5. ✅ **Standardized API** - Same pattern for all collections
6. ✅ **Filtering & Sorting** - Built-in query options support
7. ✅ **Pagination** - Offset and cursor-based pagination
8. ✅ **Mutations** - Create, update, delete with automatic invalidation
9. ✅ **Discovery** - Find available collections dynamically
10. ✅ **Documentation** - Extensive examples and migration guides

## Next Steps

1. **Migrate existing code** - Use `MIGRATION_EXAMPLE.md` as a guide
2. **Create more specialized hooks** - Follow `use-models-collection.ts` pattern
3. **Add tests** - Unit tests for utilities, integration tests for hooks
4. **Extend types** - Add more collection-specific types as needed
5. **Add WebSocket support** - Real-time updates via WebSocket subscriptions

## Related Documentation

- [TanStack DB Collections](https://tanstack.com/db/latest/docs/collections/query-collection)
- [TanStack Query](https://tanstack.com/query/latest)
- [@decocms/bindings](https://github.com/decocms/bindings)
- [README.md](./README.md) - Main documentation
- [EXAMPLES.md](./EXAMPLES.md) - Complete examples
- [MIGRATION_EXAMPLE.md](./MIGRATION_EXAMPLE.md) - Migration guide


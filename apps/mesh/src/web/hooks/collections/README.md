# Collection Hooks

This folder contains React hooks for working with collections through MCP connections, following [TanStack DB collection patterns](https://tanstack.com/db/latest/docs/collections/query-collection).

## Overview

Collections provide a standardized way to interact with data sources through MCP connections. These hooks abstract the complexity of calling collection tools and managing cache invalidation.

## Hooks

### `useCollectionQuery`

Query a collection list with optional filtering, sorting, and pagination.

```tsx
import { useCollectionQuery } from "@/web/hooks/collections";

function MyComponent() {
  const { data, isLoading, error } = useCollectionQuery({
    connectionId: connection.id,
    collectionName: "MODELS",
    enabled: Boolean(connection),
    staleTime: 30_000,
  });

  return (
    <div>
      {data?.items.map((item) => (
        <div key={item.id}>{item.title}</div>
      ))}
    </div>
  );
}
```

### With Filters and Sorting

```tsx
const messagesQuery = useCollectionQuery({
  connectionId: connection.id,
  collectionName: "MESSAGES",
  queryOptions: {
    where: [{ field: "status", operator: "eq", value: "active" }],
    orderBy: [{ field: "createdAt", direction: "desc" }],
    limit: 50,
  },
});
```

### `useCollectionItem`

Query a single item by ID.

```tsx
import { useCollectionItem } from "@/web/hooks/collections";

function ModelDetail({ modelId }: { modelId: string }) {
  const { data, isLoading } = useCollectionItem({
    connectionId: connection.id,
    collectionName: "MODELS",
    id: modelId,
  });

  return <div>{data?.item.title}</div>;
}
```

### `useCollectionMutations`

Perform create, update, and delete operations on collections.

```tsx
import { useCollectionMutations } from "@/web/hooks/collections";

function ModelEditor() {
  const mutations = useCollectionMutations({
    connectionId: connection.id,
    collectionName: "MODELS",
    invalidateOnSuccess: true,
    onCreateSuccess: (data) => {
      console.log("Created:", data);
    },
  });

  const handleCreate = async () => {
    await mutations.createItem.mutateAsync({
      item: {
        id: "custom-model",
        title: "My Custom Model",
        provider: "openai-compatible",
      },
    });
  };

  const handleUpdate = async (id: string) => {
    await mutations.updateItem.mutateAsync({
      id,
      changes: { title: "Updated Title" },
    });
  };

  const handleDelete = async (id: string) => {
    await mutations.deleteItem.mutateAsync({ id });
  };

  return (
    <div>
      <button onClick={handleCreate}>Create</button>
      {/* ... */}
    </div>
  );
}
```

## Collection Tool Naming Convention

Collections follow the `DECO_COLLECTION_{NAME}_{OPERATION}` naming pattern:

- `DECO_COLLECTION_MODELS_LIST` - List all models
- `DECO_COLLECTION_MODELS_GET` - Get a single model
- `DECO_COLLECTION_MODELS_CREATE` - Create a model
- `DECO_COLLECTION_MODELS_UPDATE` - Update a model
- `DECO_COLLECTION_MODELS_DELETE` - Delete a model
- `DECO_COLLECTION_MODELS_BATCH` - Batch operations

## Query Key Structure

Collection hooks generate structured query keys for proper cache management:

```typescript
// List queries
[connectionId, "collection", collectionName, "list", queryOptions?]

// Item queries
[connectionId, "collection", collectionName, "item", id]

// Invalidation prefix
[connectionId, "collection", collectionName]
```

## Type Safety

All hooks are fully typed with TypeScript generics:

```tsx
interface Model {
  id: string;
  title: string;
  provider: string;
}

const modelsQuery = useCollectionQuery<Model>({
  connectionId: connection.id,
  collectionName: "MODELS",
});

// modelsQuery.data.items is typed as Model[]
```

## Integration with Existing Code

### Migrating from Manual Queries

**Before:**

```tsx
const modelsQuery = useQuery({
  queryKey: KEYS.modelsList(orgSlug),
  enabled: Boolean(orgSlug) && Boolean(connection),
  staleTime: 30_000,
  queryFn: async () => {
    if (!connection) {
      throw new Error("No connection available");
    }

    const callTool = createConnectionToolCaller(connection.id);
    const result = await callTool("DECO_COLLECTION_MODELS_LIST", {});

    return {
      models: result?.items ?? [],
    } as ModelsResponse;
  },
});
```

**After:**

```tsx
const modelsQuery = useCollectionQuery<Model>({
  connectionId: connection.id,
  collectionName: "MODELS",
  enabled: Boolean(connection),
  staleTime: 30_000,
});

// Access items via modelsQuery.data.items
```

## Advanced Usage

### Custom Transformations

```tsx
const modelsQuery = useCollectionQuery<Model>({
  connectionId: connection.id,
  collectionName: "MODELS",
  select: (data) => {
    // Transform the response
    return {
      models: data.items.map((model) => ({
        ...model,
        displayName: `${model.provider}/${model.title}`,
      })),
      count: data.total ?? data.items.length,
    };
  },
});
```

### Pagination with Cursor

```tsx
const [cursor, setCursor] = useState<string>();

const messagesQuery = useCollectionQuery({
  connectionId: connection.id,
  collectionName: "MESSAGES",
  queryOptions: {
    limit: 50,
    cursor,
  },
});

// Load next page
if (messagesQuery.data?.hasMore) {
  setCursor(messagesQuery.data.cursor);
}
```

### Polling

```tsx
const activeMessagesQuery = useCollectionQuery({
  connectionId: connection.id,
  collectionName: "MESSAGES",
  queryOptions: {
    where: [{ field: "status", operator: "eq", value: "active" }],
  },
  refetchInterval: 5000, // Poll every 5 seconds
});
```

## Related Documentation

- [TanStack DB Collections](https://tanstack.com/db/latest/docs/collections/query-collection)
- [TanStack Query](https://tanstack.com/query/latest)
- [@decocms/bindings](https://github.com/decocms/bindings)


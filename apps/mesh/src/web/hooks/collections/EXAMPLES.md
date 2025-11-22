# Collection Hooks - Complete Examples

This document provides complete, real-world examples of using the collection hooks.

## Example 1: Simple Model List

The most basic usage - fetching a list of models:

```tsx
import { useCollectionQuery } from "@/web/hooks/collections";

interface Model {
  id: string;
  title: string;
  provider: string;
}

function ModelList({ connectionId }: { connectionId: string }) {
  const { data, isLoading, error } = useCollectionQuery<Model>({
    connectionId,
    collectionName: "MODELS",
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {data?.items.map((model) => (
        <li key={model.id}>
          {model.title} ({model.provider})
        </li>
      ))}
    </ul>
  );
}
```

## Example 2: Using the Specialized Models Hook

For common collections like MODELS, use the specialized hook:

```tsx
import { useModelsCollection } from "@/web/hooks/collections/use-models-collection";

function ModelSelector({ connectionId }: { connectionId: string }) {
  const { models, isLoading, error } = useModelsCollection({
    connectionId,
    enabled: Boolean(connectionId),
  });

  return (
    <select>
      {models.map((model) => (
        <option key={model.id} value={model.id}>
          {model.name} - ${model.inputCost?.toFixed(2)}/1M tokens
        </option>
      ))}
    </select>
  );
}
```

## Example 3: Filtering and Sorting

Filter models by provider and sort by cost:

```tsx
import { useCollectionQuery } from "@/web/hooks/collections";

function AnthropicModels({ connectionId }: { connectionId: string }) {
  const query = useCollectionQuery({
    connectionId,
    collectionName: "MODELS",
    queryOptions: {
      where: [
        { field: "provider", operator: "eq", value: "anthropic" }
      ],
      orderBy: [
        { field: "costs.input", direction: "asc" }
      ],
    },
  });

  return (
    <div>
      <h2>Anthropic Models (Cheapest First)</h2>
      {query.data?.items.map((model) => (
        <div key={model.id}>{model.title}</div>
      ))}
    </div>
  );
}
```

## Example 4: Pagination

Implement pagination with offset-based pagination:

```tsx
import { useState } from "react";
import { useCollectionQuery } from "@/web/hooks/collections";

function PaginatedMessages({ connectionId }: { connectionId: string }) {
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const query = useCollectionQuery({
    connectionId,
    collectionName: "MESSAGES",
    queryOptions: {
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      orderBy: [{ field: "createdAt", direction: "desc" }],
    },
  });

  const totalPages = query.data?.total
    ? Math.ceil(query.data.total / PAGE_SIZE)
    : 1;

  return (
    <div>
      <div>
        {query.data?.items.map((message) => (
          <div key={message.id}>{message.content}</div>
        ))}
      </div>

      <div>
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
        >
          Previous
        </button>

        <span>
          Page {page + 1} of {totalPages}
        </span>

        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={page >= totalPages - 1}
        >
          Next
        </button>
      </div>
    </div>
  );
}
```

## Example 5: Cursor-Based Pagination

For infinite scroll or "load more" patterns:

```tsx
import { useState } from "react";
import { useCollectionQuery } from "@/web/hooks/collections";

function InfiniteMessages({ connectionId }: { connectionId: string }) {
  const [cursor, setCursor] = useState<string | undefined>();
  const [allItems, setAllItems] = useState<any[]>([]);

  const query = useCollectionQuery({
    connectionId,
    collectionName: "MESSAGES",
    queryOptions: {
      limit: 50,
      cursor,
    },
    // Don't enable until we have a cursor (for subsequent loads)
    enabled: cursor === undefined || Boolean(cursor),
  });

  // Accumulate items as we load more
  useEffect(() => {
    if (query.data?.items) {
      setAllItems((prev) =>
        cursor ? [...prev, ...query.data.items] : query.data.items,
      );
    }
  }, [query.data, cursor]);

  const loadMore = () => {
    if (query.data?.hasMore && query.data?.cursor) {
      setCursor(query.data.cursor);
    }
  };

  return (
    <div>
      <div>
        {allItems.map((message) => (
          <div key={message.id}>{message.content}</div>
        ))}
      </div>

      {query.data?.hasMore && (
        <button onClick={loadMore} disabled={query.isLoading}>
          {query.isLoading ? "Loading..." : "Load More"}
        </button>
      )}
    </div>
  );
}
```

## Example 6: Creating, Updating, and Deleting

Full CRUD operations on a collection:

```tsx
import {
  useCollectionQuery,
  useCollectionMutations,
} from "@/web/hooks/collections";
import { useState } from "react";

interface CustomModel {
  id: string;
  title: string;
  provider: "openai-compatible";
  endpoint: {
    url: string;
    method: string;
    contentType: string;
    stream: boolean;
  };
}

function ModelManager({ connectionId }: { connectionId: string }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  // Query all models
  const modelsQuery = useCollectionQuery<CustomModel>({
    connectionId,
    collectionName: "MODELS",
  });

  // Setup mutations
  const mutations = useCollectionMutations<CustomModel>({
    connectionId,
    collectionName: "MODELS",
    invalidateOnSuccess: true,
    onCreateSuccess: () => {
      alert("Model created!");
    },
    onUpdateSuccess: () => {
      alert("Model updated!");
      setEditingId(null);
    },
    onDeleteSuccess: (id) => {
      alert(`Model ${id} deleted!`);
    },
  });

  const handleCreate = async () => {
    await mutations.createItem.mutateAsync({
      item: {
        id: `custom-${Date.now()}`,
        title: "My Custom Model",
        provider: "openai-compatible",
        endpoint: {
          url: "https://api.example.com/v1/chat/completions",
          method: "POST",
          contentType: "application/json",
          stream: true,
        },
      },
    });
  };

  const handleUpdate = async (id: string) => {
    await mutations.updateItem.mutateAsync({
      id,
      changes: {
        title: "Updated Model Title",
      },
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm(`Delete model ${id}?`)) {
      await mutations.deleteItem.mutateAsync({ id });
    }
  };

  return (
    <div>
      <button
        onClick={handleCreate}
        disabled={mutations.createItem.isPending}
      >
        Create Model
      </button>

      <div>
        {modelsQuery.data?.items.map((model) => (
          <div key={model.id}>
            <span>{model.title}</span>
            <button onClick={() => handleUpdate(model.id)}>Edit</button>
            <button onClick={() => handleDelete(model.id)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Example 7: Optimistic Updates

Update the UI immediately, then sync with server:

```tsx
import { useQueryClient } from "@tanstack/react-query";
import {
  useCollectionQuery,
  useCollectionMutations,
  getCollectionListKey,
} from "@/web/hooks/collections";

function OptimisticMessages({ connectionId }: { connectionId: string }) {
  const queryClient = useQueryClient();

  const messagesQuery = useCollectionQuery({
    connectionId,
    collectionName: "MESSAGES",
  });

  const mutations = useCollectionMutations({
    connectionId,
    collectionName: "MESSAGES",
    invalidateOnSuccess: false, // We'll handle invalidation manually
  });

  const sendMessage = async (content: string) => {
    const tempId = `temp-${Date.now()}`;
    const tempMessage = {
      id: tempId,
      content,
      status: "sending",
      createdAt: new Date().toISOString(),
    };

    // Get the query key
    const queryKey = getCollectionListKey({
      connectionId,
      collectionName: "MESSAGES",
    });

    // Optimistically update the cache
    queryClient.setQueryData(queryKey, (old: any) => ({
      ...old,
      items: [...(old?.items ?? []), tempMessage],
    }));

    try {
      // Send to server
      const result = await mutations.createItem.mutateAsync({
        item: { content },
      });

      // Replace temp message with real one
      queryClient.setQueryData(queryKey, (old: any) => ({
        ...old,
        items: old.items.map((msg: any) =>
          msg.id === tempId ? result : msg,
        ),
      }));
    } catch (error) {
      // Rollback on error
      queryClient.setQueryData(queryKey, (old: any) => ({
        ...old,
        items: old.items.filter((msg: any) => msg.id !== tempId),
      }));
      throw error;
    }
  };

  return (
    <div>
      {messagesQuery.data?.items.map((msg) => (
        <div key={msg.id}>{msg.content}</div>
      ))}

      <button onClick={() => sendMessage("Hello!")}>Send Message</button>
    </div>
  );
}
```

## Example 8: Real-Time Updates with Polling

Keep data fresh with automatic polling:

```tsx
import { useCollectionQuery } from "@/web/hooks/collections";

function LiveMessages({ connectionId }: { connectionId: string }) {
  const query = useCollectionQuery({
    connectionId,
    collectionName: "MESSAGES",
    queryOptions: {
      where: [{ field: "status", operator: "eq", value: "active" }],
      orderBy: [{ field: "createdAt", direction: "desc" }],
      limit: 50,
    },
    // Poll every 5 seconds
    refetchInterval: 5000,
    // Keep refetching even when window is not focused
    refetchIntervalInBackground: true,
  });

  return (
    <div>
      <div>
        Last updated: {new Date(query.dataUpdatedAt).toLocaleTimeString()}
      </div>

      {query.data?.items.map((message) => (
        <div key={message.id}>{message.content}</div>
      ))}
    </div>
  );
}
```

## Example 9: Multi-Connection Collection

Query the same collection from multiple connections:

```tsx
import { useCollectionQuery } from "@/web/hooks/collections";

function MultiProviderModels({
  connections,
}: {
  connections: Array<{ id: string; name: string }>;
}) {
  // Query each connection separately
  const queries = connections.map((conn) =>
    useCollectionQuery({
      connectionId: conn.id,
      collectionName: "MODELS",
      additionalKeyParts: [conn.id], // Ensure unique cache keys
    }),
  );

  return (
    <div>
      {connections.map((conn, index) => (
        <div key={conn.id}>
          <h3>{conn.name}</h3>
          {queries[index].isLoading ? (
            <div>Loading...</div>
          ) : (
            <ul>
              {queries[index].data?.items.map((model) => (
                <li key={model.id}>{model.title}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
```

## Example 10: Collection Discovery

Discover what collections are available:

```tsx
import {
  useConnectionCollections,
  useHasCollection,
} from "@/web/hooks/collections/use-connection-collections";

function ConnectionInfo({ connectionId }: { connectionId: string }) {
  const { data: collections, isLoading } = useConnectionCollections({
    connectionId,
  });

  const hasModels = useHasCollection({
    connectionId,
    collectionName: "MODELS",
  });

  if (isLoading) return <div>Discovering collections...</div>;

  return (
    <div>
      <h3>Available Collections:</h3>
      {collections?.map((collection) => (
        <div key={collection.name}>
          <strong>{collection.name}</strong>
          <ul>
            {Object.entries(collection.operations)
              .filter(([_, supported]) => supported)
              .map(([op]) => (
                <li key={op}>{op}</li>
              ))}
          </ul>
        </div>
      ))}

      {hasModels && <div>✅ This connection supports MODELS</div>}
    </div>
  );
}
```


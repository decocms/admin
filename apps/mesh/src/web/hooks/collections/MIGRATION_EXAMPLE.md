# Migration Example: deco-chat-panel.tsx

This document shows how to migrate from manual collection queries to the new collection hooks.

## Before: Manual Query

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

// Transform models
const models = useMemo(() => {
  if (!modelsQuery.data?.models) return [];
  // ... transformation logic
  return modelsQuery.data.models.map((model: Model) => {
    // ... transformations
  });
}, [modelsQuery.data]);
```

## After: Using Collection Hooks

```tsx
import { useCollectionQuery } from "@/web/hooks/collections";

// Define the Model type
interface Model {
  id: string;
  title: string;
  provider: string;
  logo: string | null;
  description: string | null;
  capabilities: string[];
  limits: {
    contextWindow: number;
    maxOutputTokens: number;
  } | null;
  costs: {
    input: number;
    output: number;
  } | null;
  endpoint: {
    url: string;
    method: string;
    contentType: string;
    stream: boolean;
  } | null;
}

// Use the collection hook with transformation built-in
const modelsQuery = useCollectionQuery<Model>({
  connectionId: connection?.id ?? "",
  collectionName: "MODELS",
  enabled: Boolean(connection),
  staleTime: 30_000,
  select: (data) => {
    // Provider logo mapping
    const providerLogos: Record<string, string> = {
      anthropic:
        "https://api.dicebear.com/7.x/initials/svg?seed=Anthropic&backgroundColor=D97706",
      openai:
        "https://api.dicebear.com/7.x/initials/svg?seed=OpenAI&backgroundColor=10B981",
      google:
        "https://api.dicebear.com/7.x/initials/svg?seed=Google&backgroundColor=3B82F6",
      "x-ai":
        "https://api.dicebear.com/7.x/initials/svg?seed=xAI&backgroundColor=8B5CF6",
    };

    const knownCapabilities = new Set([
      "reasoning",
      "image-upload",
      "file-upload",
      "web-search",
    ]);

    // Transform items directly in select
    return data.items.map((model) => {
      const provider = model.id.split("/")[0] || "";
      const logo = model.logo || providerLogos[provider] || null;

      const capabilities = model.capabilities.filter((cap) =>
        knownCapabilities.has(cap),
      );

      const inputCost = model.costs?.input
        ? model.costs.input * 1_000_000
        : null;
      const outputCost = model.costs?.output
        ? model.costs.output * 1_000_000
        : null;

      return {
        id: model.id,
        model: model.title,
        name: model.title,
        logo,
        description: model.description,
        capabilities,
        inputCost,
        outputCost,
        contextWindow: model.limits?.contextWindow ?? null,
        outputLimit: model.limits?.maxOutputTokens ?? null,
        provider: model.provider,
        endpoint: model.endpoint,
      };
    });
  },
});

// Access transformed data directly
const models = modelsQuery.data ?? [];
```

## Benefits of Migration

1. **Less Boilerplate**: No need to manually create tool callers or handle errors
2. **Better Type Safety**: Fully typed with generics
3. **Consistent Caching**: Automatic query key generation
4. **Built-in Transformations**: Use `select` for data transformations
5. **Standardized API**: Same pattern for all collections

## Additional Examples

### Filtering and Sorting

```tsx
// Get only active models, sorted by name
const activeModelsQuery = useCollectionQuery<Model>({
  connectionId: connection.id,
  collectionName: "MODELS",
  queryOptions: {
    where: [{ field: "status", operator: "eq", value: "active" }],
    orderBy: [{ field: "title", direction: "asc" }],
  },
});
```

### Pagination

```tsx
const [page, setPage] = useState(0);
const PAGE_SIZE = 20;

const paginatedQuery = useCollectionQuery<Model>({
  connectionId: connection.id,
  collectionName: "MODELS",
  queryOptions: {
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  },
});

// Navigate pages
const nextPage = () => setPage((p) => p + 1);
const prevPage = () => setPage((p) => Math.max(0, p - 1));
```

### Mutations

```tsx
import { useCollectionMutations } from "@/web/hooks/collections";

function ModelManager() {
  const mutations = useCollectionMutations({
    connectionId: connection.id,
    collectionName: "MODELS",
    invalidateOnSuccess: true,
    onCreateSuccess: (data) => {
      toast.success("Model created successfully");
    },
  });

  const handleCreateModel = async () => {
    await mutations.createItem.mutateAsync({
      item: {
        id: "custom-model",
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

  return (
    <button
      onClick={handleCreateModel}
      disabled={mutations.createItem.isPending}
    >
      Create Model
    </button>
  );
}
```

## Complete Refactored Component

```tsx
import { useCollectionQuery } from "@/web/hooks/collections";
import { useEffect, useMemo } from "react";

function DecoChatPanelInner() {
  // ... existing setup code

  // Replace manual query with collection hook
  const modelsQuery = useCollectionQuery<Model>({
    connectionId: connection?.id ?? "",
    collectionName: "MODELS",
    enabled: Boolean(connection),
    staleTime: 30_000,
  });

  // Transform models (can also be done in select above)
  const models = useMemo(() => {
    if (!modelsQuery.data?.items) return [];

    const providerLogos: Record<string, string> = {
      anthropic: "...",
      openai: "...",
      // ...
    };

    return modelsQuery.data.items.map((model) => {
      // ... transformation logic
    });
  }, [modelsQuery.data]);

  // Rest of component logic remains the same
  // ...
}
```


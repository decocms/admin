import { useConnection } from "@/web/hooks/collections/use-connection";
import { createToolCaller } from "@/tools/client";
import { StoreDiscoveryUI } from "./store-discovery-ui";
import type { RegistryItem } from "./registry-items-section";
import { useInfiniteQuery } from "@tanstack/react-query";
import { KEYS } from "@/web/lib/query-keys";

interface StoreDiscoveryProps {
  registryId: string;
}

const PAGE_SIZE = 42;

export function StoreDiscovery({ registryId }: StoreDiscoveryProps) {
  const registryConnection = useConnection(registryId);

  // Find the LIST tool from the registry connection
  const listToolName = !registryConnection?.tools
    ? ""
    : (() => {
        const listTool = registryConnection.tools.find((tool) =>
          tool.name.endsWith("_LIST"),
        );
        return listTool?.name || "";
      })();

  const toolCaller = createToolCaller(registryId);

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: KEYS.toolCall(
      listToolName,
      JSON.stringify({ limit: PAGE_SIZE }),
      registryId,
    ),
    queryFn: async ({ pageParam }) => {
      // Use cursor if available, otherwise fallback to offset for backward compatibility
      const params = pageParam
        ? { cursor: pageParam, limit: PAGE_SIZE }
        : { limit: PAGE_SIZE };
      const result = await toolCaller(listToolName, params);
      return result;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      // Extract items from last page
      let items: RegistryItem[] = [];

      if (Array.isArray(lastPage)) {
        items = lastPage;
      } else if (typeof lastPage === "object" && lastPage !== null) {
        const itemsKey = Object.keys(lastPage).find((key) =>
          Array.isArray(lastPage[key as keyof typeof lastPage]),
        );
        if (itemsKey) {
          items = lastPage[itemsKey as keyof typeof lastPage] as RegistryItem[];
        }
      }

      // Check if hasMore indicates there are more pages
      const hasMore =
        typeof lastPage === "object" && lastPage !== null
          ? ((lastPage as { hasMore?: boolean }).hasMore ?? false)
          : false;

      // Check if API provides a nextCursor field
      const nextCursor =
        typeof lastPage === "object" && lastPage !== null
          ? (lastPage as { nextCursor?: string; cursor?: string }).nextCursor ||
            (lastPage as { nextCursor?: string; cursor?: string }).cursor
          : undefined;

      // Prefer API-provided cursor if available
      if (nextCursor) {
        return nextCursor;
      }

      // Fallback: Use the last item's ID as the next cursor if there are more pages
      if (hasMore && items.length > 0) {
        const lastItem = items[items.length - 1];
        if (lastItem?.id) {
          return lastItem.id;
        }
      }

      return undefined;
    },
    enabled: !!listToolName,
    staleTime: 60 * 60 * 1000, // 1 hour - keep data fresh longer
  });

  // Flatten all pages into a single array of items
  const allItems = (() => {
    if (!data?.pages) return [];

    const items: RegistryItem[] = [];

    for (const page of data.pages) {
      let pageItems: RegistryItem[] = [];

      if (Array.isArray(page)) {
        pageItems = page;
      } else if (typeof page === "object" && page !== null) {
        const itemsKey = Object.keys(page).find((key) =>
          Array.isArray(page[key as keyof typeof page]),
        );
        if (itemsKey) {
          pageItems = page[itemsKey as keyof typeof page] as RegistryItem[];
        }
      }

      items.push(...pageItems);
    }

    return items;
  })();

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  return (
    <StoreDiscoveryUI
      items={allItems}
      isLoading={isLoading}
      isLoadingMore={isFetchingNextPage}
      error={error}
      registryId={registryId}
      hasMore={hasNextPage ?? false}
      onLoadMore={handleLoadMore}
    />
  );
}

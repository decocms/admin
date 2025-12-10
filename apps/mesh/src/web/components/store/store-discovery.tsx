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
      // Only proceed with pagination if API provides a cursor
      // If no cursor is available, return undefined to stop pagination
      if (typeof lastPage === "object" && lastPage !== null) {
        const nextCursor =
          (lastPage as { nextCursor?: string; cursor?: string }).nextCursor ||
          (lastPage as { nextCursor?: string; cursor?: string }).cursor;

        // Only return cursor if API explicitly provides one
        if (nextCursor) {
          return nextCursor;
        }
      }

      // No cursor available - stop pagination
      return undefined;
    },
    enabled: !!listToolName,
    staleTime: 60 * 60 * 1000, // 1 hour - keep data fresh longer
  });

  // Extract totalCount from first page if available
  const totalCount = (() => {
    if (!data?.pages || data.pages.length === 0) return null;
    const firstPage = data.pages[0];
    if (
      typeof firstPage === "object" &&
      firstPage !== null &&
      "totalCount" in firstPage &&
      typeof firstPage.totalCount === "number"
    ) {
      return firstPage.totalCount;
    }
    return null;
  })();

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
      totalCount={totalCount}
    />
  );
}

import { useConnection } from "@/web/hooks/collections/use-connection";
import { useToolCall } from "@/web/hooks/use-tool-call";
import { createToolCaller } from "@/tools/client";
import { StoreDiscoveryUI } from "./store-discovery-ui";
import type { RegistryItem } from "./registry-items-section";
import { useState, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { KEYS } from "@/web/lib/query-keys";

interface StoreDiscoveryProps {
  registryId: string;
}

const PAGE_SIZE = 42;

export function StoreDiscovery({ registryId }: StoreDiscoveryProps) {
  const registryConnection = useConnection(registryId);
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [allItems, setAllItems] = useState<RegistryItem[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const lastRegistryIdRef = useRef<string>("");

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
    data: listResults,
    isLoading,
    error,
  } = useToolCall({
    toolCaller,
    toolName: listToolName,
    toolInputParams: { offset, limit: PAGE_SIZE },
    connectionId: registryId,
    enabled: !!listToolName && hasMore,
    staleTime: 60 * 60 * 1000, // 1 hour - keep data fresh longer
  });

  // Extract items and pagination info from results
  const currentPageItems: RegistryItem[] = useMemo(() => {
    if (!listResults) return [];

    if (Array.isArray(listResults)) {
      return listResults;
    }

    if (typeof listResults === "object" && listResults !== null) {
      const itemsKey = Object.keys(listResults).find((key) =>
        Array.isArray(listResults[key as keyof typeof listResults]),
      );

      if (itemsKey) {
        return listResults[itemsKey as keyof typeof listResults] as RegistryItem[];
      }
    }

    return [];
  }, [listResults]);

  const currentHasMore = useMemo(() => {
    if (!listResults || typeof listResults !== "object") return false;
    return (listResults as { hasMore?: boolean }).hasMore ?? false;
  }, [listResults]);

  // Accumulate items when new page loads
  useEffect(() => {
    if (currentPageItems.length > 0 && !isLoading) {
      // Only add items if this is a new page (offset matches current items length)
      if (offset === allItems.length) {
        setAllItems((prev) => [...prev, ...currentPageItems]);
        setHasMore(currentHasMore);
      }
    }
  }, [currentPageItems, currentHasMore, offset, allItems.length, isLoading]);

  // Reconstruct accumulated items from cache when component mounts or registry changes
  useEffect(() => {
    if (!registryId || !listToolName) return;

    // If registry changed, reset everything
    if (lastRegistryIdRef.current !== registryId) {
      setAllItems([]);
      setOffset(0);
      setHasMore(true);
      lastRegistryIdRef.current = registryId;
      return;
    }

    // If same registry, try to reconstruct from cache
    // Check cache for pages we might have loaded
    const reconstructedItems: RegistryItem[] = [];
    let foundPages = 0;
    let lastHasMore = true;

    for (let i = 0; i < 10; i++) { // Check up to 10 pages
      const pageOffset = i * PAGE_SIZE;
      const cacheKey = KEYS.toolCall(
        listToolName,
        JSON.stringify({ offset: pageOffset, limit: PAGE_SIZE }),
        registryId,
      );
      const cachedData = queryClient.getQueryData(cacheKey) as
        | { items?: RegistryItem[]; hasMore?: boolean }
        | RegistryItem[]
        | undefined;

      if (cachedData) {
        const items = Array.isArray(cachedData)
          ? cachedData
          : cachedData.items || [];
        
        if (items.length > 0) {
          reconstructedItems.push(...items);
          foundPages++;
          lastHasMore = Array.isArray(cachedData)
            ? true
            : cachedData.hasMore ?? true;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    // Only update if we found cached data and current state is empty
    if (foundPages > 0 && allItems.length === 0) {
      setAllItems(reconstructedItems);
      setOffset(reconstructedItems.length);
      setHasMore(lastHasMore);
    }
  }, [registryId, listToolName, queryClient, allItems.length]);

  const handleLoadMore = () => {
    if (!isLoading && hasMore) {
      setOffset(allItems.length);
    }
  };

  return (
    <StoreDiscoveryUI
      items={allItems}
      isLoading={isLoading && offset === 0}
      isLoadingMore={isLoading && offset > 0}
      error={error}
      registryId={registryId}
      hasMore={hasMore}
      onLoadMore={handleLoadMore}
    />
  );
}

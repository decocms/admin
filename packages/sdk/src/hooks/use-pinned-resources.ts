import { useCallback } from "react";
import { useLocalStorage } from "../../../../apps/web/src/hooks/use-local-storage.ts";

export interface PinnedItem {
  id: string;
  name: string;
  type: "document" | "agent" | "workflow" | "tool" | "view" | "file";
  integration_id?: string;
  icon?: string;
  pinned_at: string;
}

export function usePinnedResources(projectKey?: string) {
  const storageKey = projectKey
    ? `pinned-resources-${projectKey.replace(/\//g, "-")}`
    : "pinned-resources";

  const [pinnedItems, setPinnedItems] = useLocalStorage<PinnedItem[]>(
    storageKey,
    [],
  );

  const pinItem = useCallback(
    (item: Omit<PinnedItem, "pinned_at">) => {
      const existing = pinnedItems.find((resource) => resource.id === item.id);
      if (existing) {
        const updated = pinnedItems.map((resource) =>
          resource.id === item.id
            ? {
                ...resource,
                ...item,
              }
            : resource,
        );
        setPinnedItems(updated);
        return;
      }

      setPinnedItems([
        {
          ...item,
          pinned_at: new Date().toISOString(),
        },
        ...pinnedItems,
      ]);
    },
    [pinnedItems, setPinnedItems],
  );

  const unpinItem = useCallback(
    (resourceId: string) => {
      if (!pinnedItems.some((resource) => resource.id === resourceId)) {
        return;
      }

      setPinnedItems(
        pinnedItems.filter((resource) => resource.id !== resourceId),
      );
    },
    [pinnedItems, setPinnedItems],
  );

  const isPinned = useCallback(
    (resourceId: string) => {
      return pinnedItems.some((resource) => resource.id === resourceId);
    },
    [pinnedItems],
  );

  const togglePin = useCallback(
    (item: Omit<PinnedItem, "pinned_at">) => {
      if (isPinned(item.id)) {
        unpinItem(item.id);
        return;
      }

      pinItem(item);
    },
    [isPinned, pinItem, unpinItem],
  );

  const reorderPinnedItems = useCallback(
    (startIndex: number, endIndex: number) => {
      if (startIndex === endIndex) return;
      if (startIndex < 0 || endIndex < 0) return;
      if (startIndex >= pinnedItems.length || endIndex >= pinnedItems.length)
        return;

      const result = [...pinnedItems];
      const [removed] = result.splice(startIndex, 1);
      if (!removed) return;

      result.splice(endIndex, 0, removed);
      setPinnedItems(result);
    },
    [pinnedItems, setPinnedItems],
  );

  return {
    pinnedItems,
    setPinnedItems,
    isPinned,
    togglePin,
    pinItem,
    unpinItem,
    pin: pinItem,
    unpin: unpinItem,
    reorderPinnedItems,
    isLoading: false,
  };
}

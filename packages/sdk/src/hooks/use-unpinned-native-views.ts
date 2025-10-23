import { useCallback, useState, useEffect } from "react";

const STORAGE_EVENT = "deco:local-storage";

export function useUnpinnedNativeViews(projectKey?: string) {
  const storageKey = projectKey
    ? `unpinned-native-views-${projectKey.replace(/\//g, "-")}`
    : "unpinned-native-views";

  const [unpinnedViewIds, setUnpinnedViewIdsState] = useState<string[]>(() => {
    if (typeof globalThis.localStorage === "undefined") return [];
    const item = globalThis.localStorage.getItem(storageKey);
    if (!item) return [];
    try {
      return JSON.parse(item) as string[];
    } catch {
      return [];
    }
  });

  // Listen for storage changes
  useEffect(() => {
    function handleStorageChange(
      event: CustomEvent<{ key: string; value: string | null }>,
    ) {
      if (event.detail.key === storageKey) {
        try {
          setUnpinnedViewIdsState(
            event.detail.value ? JSON.parse(event.detail.value) : [],
          );
        } catch {
          setUnpinnedViewIdsState([]);
        }
      }
    }
    globalThis.addEventListener(
      STORAGE_EVENT,
      handleStorageChange as EventListener,
    );
    return () => {
      globalThis.removeEventListener(
        STORAGE_EVENT,
        handleStorageChange as EventListener,
      );
    };
  }, [storageKey]);

  const setUnpinnedViewIds = useCallback(
    (updater: string[] | ((prev: string[]) => string[])) => {
      setUnpinnedViewIdsState((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        if (typeof globalThis.localStorage !== "undefined") {
          globalThis.localStorage.setItem(storageKey, JSON.stringify(next));
          // Defer the broadcast to the next tick to avoid cross-render setState warnings
          setTimeout(() => {
            globalThis.dispatchEvent(
              new CustomEvent(STORAGE_EVENT, {
                detail: { key: storageKey, value: JSON.stringify(next) },
              }),
            );
          }, 0);
        }
        return next;
      });
    },
    [storageKey],
  );

  const unpinView = useCallback(
    (viewId: string) => {
      setUnpinnedViewIds((prev) => {
        if (prev.includes(viewId)) return prev;
        return [...prev, viewId];
      });
    },
    [setUnpinnedViewIds],
  );

  const pinView = useCallback(
    (viewId: string) => {
      setUnpinnedViewIds((prev) => prev.filter((id) => id !== viewId));
    },
    [setUnpinnedViewIds],
  );

  const isViewUnpinned = useCallback(
    (viewId: string) => {
      return unpinnedViewIds.includes(viewId);
    },
    [unpinnedViewIds],
  );

  return {
    unpinnedViewIds,
    unpinView,
    pinView,
    isViewUnpinned,
  };
}

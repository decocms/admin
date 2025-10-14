import {
  useCallback,
  useMemo,
  useState,
  useEffect,
  useLayoutEffect,
} from "react";

export interface RecentResource {
  id: string;
  name: string;
  type: "document" | "agent" | "workflow" | "tool" | "view" | "file";
  integration_id?: string;
  icon?: string;
  timestamp: number;
  path: string; // URL path to navigate to
}

const MAX_RECENT_ITEMS = 50;
const STORAGE_EVENT = "deco:local-storage";

export function useRecentResources(projectId?: string) {
  const storageKey = projectId
    ? `recent-resources-${projectId.replace(/\//g, "-")}`
    : "recent-resources";

  const [recents, setRecentsState] = useState<RecentResource[]>(() => {
    if (typeof globalThis.localStorage === "undefined") return [];
    const item = globalThis.localStorage.getItem(storageKey);
    if (!item) return [];
    try {
      return JSON.parse(item) as RecentResource[];
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
          setRecentsState(
            event.detail.value ? JSON.parse(event.detail.value) : [],
          );
        } catch {
          setRecentsState([]);
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

  const setRecents = useCallback(
    (
      updater:
        | RecentResource[]
        | ((prev: RecentResource[]) => RecentResource[]),
    ) => {
      setRecentsState((prev) => {
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

  const addRecent = useCallback(
    (resource: Omit<RecentResource, "timestamp">) => {
      setRecents((prev) => {
        // Check if item already exists
        const existingIndex = prev.findIndex((r) => r.id === resource.id);
        if (existingIndex !== -1) {
          const existing = prev[existingIndex];
          // Item already exists - update name/icon if changed, but keep position and timestamp
          if (
            existing.name !== resource.name ||
            existing.icon !== resource.icon
          ) {
            const updated = [...prev];
            updated[existingIndex] = {
              ...existing,
              name: resource.name,
              icon: resource.icon,
            };
            return updated;
          }
          // No changes needed
          return prev;
        }

        // Add new entry at the beginning
        const updated = [
          {
            ...resource,
            timestamp: Date.now(),
          },
          ...prev,
        ];

        // Trim to max items
        return updated.slice(0, MAX_RECENT_ITEMS);
      });
    },
    [setRecents],
  );

  const removeRecent = useCallback(
    (resourceId: string) => {
      setRecents((prev) => prev.filter((r) => r.id !== resourceId));
    },
    [setRecents],
  );

  const clearRecents = useCallback(() => {
    setRecents([]);
  }, [setRecents]);

  const sortedRecents = useMemo(() => {
    return [...recents].sort((a, b) => b.timestamp - a.timestamp);
  }, [recents]);

  return {
    recents: sortedRecents,
    addRecent,
    removeRecent,
    clearRecents,
  };
}

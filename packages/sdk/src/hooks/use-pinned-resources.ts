import { useCallback, useState, useEffect } from "react";

export interface PinnedResource {
  id: string;
  name: string;
  type: "document" | "agent" | "workflow" | "tool" | "view" | "file";
  integration_id?: string;
  icon?: string;
  path: string; // URL path to navigate to
  pinned_at: string;
}

const STORAGE_EVENT = "deco:local-storage";

export function usePinnedResources(projectKey?: string) {
  const storageKey = projectKey
    ? `pinned-resources-${projectKey.replace(/\//g, "-")}`
    : "pinned-resources";

  const [pinnedResources, setPinnedResourcesState] = useState<PinnedResource[]>(
    () => {
      if (typeof globalThis.localStorage === "undefined") return [];
      const item = globalThis.localStorage.getItem(storageKey);
      if (!item) return [];
      try {
        return JSON.parse(item) as PinnedResource[];
      } catch {
        return [];
      }
    },
  );

  // Listen for storage changes
  useEffect(() => {
    function handleStorageChange(
      event: CustomEvent<{ key: string; value: string | null }>,
    ) {
      if (event.detail.key === storageKey) {
        try {
          setPinnedResourcesState(
            event.detail.value ? JSON.parse(event.detail.value) : [],
          );
        } catch {
          setPinnedResourcesState([]);
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

  const setPinnedResources = useCallback(
    (
      updater:
        | PinnedResource[]
        | ((prev: PinnedResource[]) => PinnedResource[]),
    ) => {
      setPinnedResourcesState((prev) => {
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

  const pin = useCallback(
    (resource: Omit<PinnedResource, "pinned_at">) => {
      setPinnedResources((prev) => {
        // Remove if already pinned
        const filtered = prev.filter((r) => r.id !== resource.id);
        // Add at beginning with timestamp
        return [
          {
            ...resource,
            pinned_at: new Date().toISOString(),
          },
          ...filtered,
        ];
      });
    },
    [setPinnedResources],
  );

  const unpin = useCallback(
    (resourceId: string) => {
      setPinnedResources((prev) => prev.filter((r) => r.id !== resourceId));
    },
    [setPinnedResources],
  );

  const isPinned = useCallback(
    (resourceId: string) => {
      return pinnedResources.some((r) => r.id === resourceId);
    },
    [pinnedResources],
  );

  const updatePinnedResource = useCallback(
    (
      resourceId: string,
      updates: Partial<Omit<PinnedResource, "id" | "pinned_at">>,
    ) => {
      setPinnedResources((prev) => {
        const index = prev.findIndex((r) => r.id === resourceId);
        if (index === -1) return prev;

        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          ...updates,
        };
        return updated;
      });
    },
    [setPinnedResources],
  );

  const togglePin = useCallback(
    (resource: Omit<PinnedResource, "pinned_at">) => {
      if (isPinned(resource.id)) {
        unpin(resource.id);
      } else {
        pin(resource);
      }
    },
    [isPinned, pin, unpin],
  );

  return {
    pinnedResources,
    isPinned,
    togglePin,
    pin,
    unpin,
    updatePinnedResource,
    isLoading: false,
  };
}

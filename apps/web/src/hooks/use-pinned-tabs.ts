import { useCallback } from "react";
import { useLocalStorage } from "./use-local-storage.ts";

export type PinnedTabType = "list" | "detail";

export interface PinnedTab {
  id: string;
  resourceUri: string;
  title: string;
  type: PinnedTabType;
  icon?: string;
  pinnedAt: string;
}

export interface PinnedTabInput {
  resourceUri: string;
  title: string;
  type: PinnedTabType;
  icon?: string;
  id?: string;
}

function resolveStorageKey(projectKey?: string) {
  if (!projectKey) {
    return "pinned-tabs";
  }
  const sanitizedProjectKey = projectKey.replace(/\//g, "-");
  return `pinned-tabs-${sanitizedProjectKey}`;
}

/**
 * Default pinned tabs that are added when a user first opens a project.
 * Users can manually pin items they want to keep in the sidebar.
 */
export const DEFAULT_PINNED_TABS: Omit<PinnedTab, "id" | "pinnedAt">[] = [];

function getDefaultPinnedTabs(): PinnedTab[] {
  const now = new Date().toISOString();
  return DEFAULT_PINNED_TABS.map((tab) => ({
    ...tab,
    id: tab.resourceUri,
    pinnedAt: now,
  }));
}

export function usePinnedTabs(projectKey?: string) {
  const storageKey = resolveStorageKey(projectKey);
  const [pinnedTabs, setPinnedTabs] = useLocalStorage<PinnedTab[]>(
    storageKey,
    // Initialize with empty array - users can manually pin items
    (existing) => {
      if (!existing) {
        return [];
      }
      return existing;
    },
  );

  const isPinned = useCallback(
    (resourceUri: string) => {
      return pinnedTabs.some((tab) => tab.resourceUri === resourceUri);
    },
    [pinnedTabs],
  );

  const pinTab = useCallback(
    (tab: PinnedTabInput) => {
      const id = tab.id ?? tab.resourceUri;
      const existingIndex = pinnedTabs.findIndex(
        (item) => item.resourceUri === tab.resourceUri,
      );
      const now = new Date().toISOString();

      const entry: PinnedTab = {
        id,
        resourceUri: tab.resourceUri,
        title: tab.title,
        type: tab.type,
        icon: tab.icon,
        pinnedAt:
          existingIndex === -1 ? now : pinnedTabs[existingIndex].pinnedAt,
      };

      if (existingIndex === -1) {
        setPinnedTabs([entry, ...pinnedTabs]);
        return;
      }

      const updated = [...pinnedTabs];
      updated[existingIndex] = entry;
      setPinnedTabs(updated);
    },
    [pinnedTabs, setPinnedTabs],
  );

  const unpinTab = useCallback(
    (resourceUri: string) => {
      if (!isPinned(resourceUri)) {
        return;
      }
      setPinnedTabs(
        pinnedTabs.filter((tab) => tab.resourceUri !== resourceUri),
      );
    },
    [isPinned, pinnedTabs, setPinnedTabs],
  );

  const togglePin = useCallback(
    (tab: PinnedTabInput) => {
      if (isPinned(tab.resourceUri)) {
        unpinTab(tab.resourceUri);
        return;
      }
      pinTab(tab);
    },
    [isPinned, pinTab, unpinTab],
  );

  const reorderPinnedTabs = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      if (fromIndex < 0 || toIndex < 0) return;
      if (fromIndex >= pinnedTabs.length || toIndex >= pinnedTabs.length) {
        return;
      }

      const updated = [...pinnedTabs];
      const [moved] = updated.splice(fromIndex, 1);
      if (!moved) {
        return;
      }
      updated.splice(toIndex, 0, moved);
      setPinnedTabs(updated);
    },
    [pinnedTabs, setPinnedTabs],
  );

  return {
    pinnedTabs,
    pinTab,
    unpinTab,
    togglePin,
    isPinned,
    reorderPinnedTabs,
    setPinnedTabs,
  };
}

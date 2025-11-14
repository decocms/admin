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
 * Old default pinned tabs that were auto-added (now removed)
 * Kept here for migration purposes to filter them out
 */
const OLD_DEFAULT_NATIVE_URIS = [
  "native://documents",
  "native://tools",
  "native://agents",
  "native://workflows",
  "native://database",
  "native://views",
];

/**
 * Default pinned tabs - now empty by default
 * Users manually pin what they want
 */
export const DEFAULT_PINNED_TABS: Omit<PinnedTab, "id" | "pinnedAt">[] = [];

export function usePinnedTabs(projectKey?: string) {
  const storageKey = resolveStorageKey(projectKey);
  const [pinnedTabs, setPinnedTabs] = useLocalStorage<PinnedTab[]>(
    storageKey,
    // Initialize with empty array and migrate old tabs
    (existing) => {
      if (!existing) {
        return [];
      }
      // Migration: Remove old default native views that were auto-pinned
      // Keep only user-pinned tabs (non-native URIs)
      const migrated = existing.filter(
        (tab) => !OLD_DEFAULT_NATIVE_URIS.includes(tab.resourceUri),
      );
      return migrated;
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

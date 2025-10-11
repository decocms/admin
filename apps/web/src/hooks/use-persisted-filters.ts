import { useEffect, useState } from "react";
import type { Filter } from "../components/resources-v2/filter-bar.tsx";

export function usePersistedFilters(
  key: string,
): [Filter[], (filters: Filter[]) => void] {
  const storageKey = `deco-filters-${key}`;

  // Initialize from localStorage
  const [filters, setFilters] = useState<Filter[]>(() => {
    try {
      const stored = globalThis.localStorage?.getItem(storageKey);
      if (stored) {
        return JSON.parse(stored) as Filter[];
      }
    } catch (error) {
      console.error("Failed to parse stored filters:", error);
    }
    return [];
  });

  // Save to localStorage when filters change
  const setFiltersWithStorage = (newFilters: Filter[]) => {
    setFilters(newFilters);
    try {
      globalThis.localStorage?.setItem(storageKey, JSON.stringify(newFilters));
    } catch (error) {
      console.error("Failed to save filters:", error);
    }
  };

  return [filters, setFiltersWithStorage];
}


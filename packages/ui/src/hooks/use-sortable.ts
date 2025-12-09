/* eslint-disable ban-memoization/ban-memoization */
import { useCallback, useState } from "react";

export interface SortableState {
  sortKey: string | undefined;
  sortDirection: "asc" | "desc" | null;
  handleSort: (columnId: string) => void;
}

/**
 * Generic hook for managing sortable table state
 * Cycles through: asc -> desc -> null (no sort)
 * Provides stable handleSort function to prevent re-renders
 */
export function useSortable(defaultKey?: string): SortableState {
  const [sortKey, setSortKey] = useState<string | undefined>(defaultKey);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>(
    defaultKey ? "desc" : null,
  );

  const handleSort = useCallback(
    (columnId: string) => {
      if (sortKey !== columnId) {
        // Clicking a new column: start with asc
        setSortKey(columnId);
        setSortDirection("asc");
      } else if (sortDirection === "asc") {
        // Second click: switch to desc
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        // Third click: reset to no sorting
        setSortKey(undefined);
        setSortDirection(null);
      }
    },
    [sortKey, sortDirection],
  );

  return {
    sortKey,
    sortDirection,
    handleSort,
  };
}

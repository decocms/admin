import type { BaseCollectionEntity } from "@decocms/bindings/collections";
import type { z } from "zod/v3";
import type { ReactNode } from "react";
import type { Filter } from "@deco/ui/components/filter-bar.tsx";
import type { TableColumn } from "@deco/ui/components/resource-table.tsx";

export interface CollectionsListProps<T extends BaseCollectionEntity> {
  /**
   * The data to display
   */
  data: T[];

  /**
   * The Zod schema defining the entity structure.
   * Used for rendering default cards and table columns.
   * Optional if `columns` and `renderCard` are provided.
   */
  schema?: z.AnyZodObject;

  /**
   * Current view mode
   */
  viewMode: "table" | "cards";

  /**
   * Callback when view mode changes
   */
  onViewModeChange?: (mode: "table" | "cards") => void;

  /**
   * Current search term
   */
  search: string;

  /**
   * Callback when search term changes
   */
  onSearchChange: (value: string) => void;

  /**
   * Current sort key
   */
  sortKey?: string;

  /**
   * Current sort direction
   */
  sortDirection?: "asc" | "desc" | null;

  /**
   * Callback when sort changes
   */
  onSort?: (key: string) => void;

  /**
   * Active filters
   */
  filters?: Filter[];

  /**
   * Callback when filters change
   */
  onFiltersChange?: (filters: Filter[]) => void;

  /**
   * Callback for item actions
   */
  onAction?: (
    action: "open" | "delete" | "duplicate" | "edit",
    item: T,
  ) => void;

  /**
   * Callback when an item is clicked
   */
  onItemClick?: (item: T) => void;

  /**
   * Extra content to render in the header (e.g. "New" button)
   */
  headerActions?: ReactNode;

  /**
   * Whether data is loading
   */
  isLoading?: boolean;

  /**
   * Custom empty state component
   */
  emptyState?: ReactNode;

  /**
   * Whether the list is read-only (hides mutation actions)
   */
  readOnly?: boolean;

  /**
   * Custom card renderer. If not provided, uses CollectionCard with schema.
   */
  renderCard?: (item: T) => ReactNode;

  /**
   * Custom table columns. If not provided, generated from schema.
   */
  columns?: TableColumn<T>[];

  /**
   * Whether to hide the toolbar (search, view toggle).
   * Useful if the parent component handles these controls.
   */
  hideToolbar?: boolean;
}

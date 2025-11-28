import {
  Table as ResourceTable,
  type TableColumn,
} from "@deco/ui/components/resource-table.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import type { ReactNode } from "react";

export interface CollectionsListProps<T> {
  data: T[];
  viewMode: "table" | "cards";
  columns?: TableColumn<T>[]; // For table mode
  renderCard?: (item: T) => ReactNode; // For card mode
  onItemClick?: (item: T) => void;
  isLoading?: boolean;
  emptyState?: ReactNode;
  sortKey?: string;
  sortDirection?: "asc" | "desc" | null;
  onSort?: (key: string) => void;
}

export function CollectionsList<T extends Record<string, unknown>>({
  data,
  viewMode,
  columns,
  renderCard,
  onItemClick,
  isLoading,
  emptyState,
  sortKey,
  sortDirection,
  onSort,
}: CollectionsListProps<T>) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Spinner />
      </div>
    );
  }

  if (data.length === 0) {
    return emptyState || null;
  }

  if (viewMode === "cards" && renderCard) {
    return (
      <div
        className="grid gap-4 p-4"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(286px, 1fr))",
        }}
      >
        {data.map((item, index) => (
          <div
            key={index}
            onClick={() => onItemClick?.(item)}
            className={onItemClick ? "cursor-pointer" : ""}
          >
            {renderCard(item)}
          </div>
        ))}
      </div>
    );
  }

  if (columns) {
    return (
      <ResourceTable
        columns={columns}
        data={data}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={onSort}
        onRowClick={onItemClick}
      />
    );
  }

  return null;
}

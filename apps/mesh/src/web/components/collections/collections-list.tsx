import type { BaseCollectionEntity } from "@decocms/bindings/collections";
import { CollectionCard } from "./collection-card.tsx";
import { CollectionTable } from "./collection-table.tsx";
import type { CollectionsListProps } from "./types";
import { Input } from "@deco/ui/components/input.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  Table as ResourceTable,
  type TableColumn,
} from "@deco/ui/components/resource-table.tsx";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@deco/ui/components/pagination.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { useEffect, useState } from "react";

export function CollectionsList<T extends BaseCollectionEntity>({
  data,
  schema,
  viewMode,
  onViewModeChange,
  search,
  onSearchChange,
  sortKey,
  sortDirection,
  onSort,
  onAction,
  onItemClick,
  headerActions,
  isLoading,
  emptyState,
  readOnly,
  renderCard,
  columns,
  hideToolbar,
  defaultItemsPerPage = 12,
  itemsPerPageOptions = [12, 24, 48, 96],
}: CollectionsListProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(defaultItemsPerPage);

  // Reset page when search or data length changes significantly
  useEffect(() => {
    setCurrentPage(1);
  }, [search, data.length, itemsPerPage]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Spinner />
      </div>
    );
  }

  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = data.slice(startIndex, endIndex);

  const handleAction = (
    action: "open" | "delete" | "duplicate" | "edit",
    item: T,
  ) => {
    onAction?.(action, item);
  };

  const hasData = data.length > 0;

  return (
    <div className="flex flex-col h-full gap-4">
      {!hideToolbar && (
        <div className="flex items-center justify-between gap-4 p-4 border-b bg-background/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Icon
                name="search"
                size={16}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {headerActions}

            {onViewModeChange && (
              <div className="flex items-center gap-1 border rounded-md p-1">
                <Button
                  variant={viewMode === "cards" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onViewModeChange("cards")}
                  title="Card View"
                >
                  <Icon name="grid_view" size={16} />
                </Button>
                <Button
                  variant={viewMode === "table" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onViewModeChange("table")}
                  title="Table View"
                >
                  <Icon name="table_rows" size={16} />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4">
        {!hasData ? (
          emptyState || (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Icon name="inbox" size={48} className="mb-4 opacity-20" />
              <p>No items found</p>
            </div>
          )
        ) : (
          <div className="space-y-4">
            {viewMode === "cards" ? (
              <div
                className="grid gap-4"
                style={{
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                }}
              >
                {currentData.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onItemClick?.(item)}
                    className={onItemClick ? "cursor-pointer" : ""}
                  >
                    {renderCard ? (
                      renderCard(item)
                    ) : schema ? (
                      <CollectionCard
                        item={item}
                        schema={schema}
                        readOnly={readOnly}
                        onAction={handleAction}
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            ) : columns ? (
              <ResourceTableWithColumns
                data={currentData}
                columns={columns}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={onSort}
                onRowClick={onItemClick}
              />
            ) : schema ? (
              <CollectionTable
                data={currentData}
                schema={schema}
                readOnly={readOnly}
                onAction={handleAction}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={onSort}
                onRowClick={onItemClick}
              />
            ) : null}
          </div>
        )}
      </div>
      {totalPages > 1 && hasData && (
        <div className="flex items-center justify-between border-t p-4 bg-background/50 backdrop-blur-sm sticky bottom-0 z-10">
          <div className="text-sm text-muted-foreground">
            Showing {startIndex + 1} to {Math.min(endIndex, totalItems)} of{" "}
            {totalItems} items
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Rows per page
              </span>
              <Select
                value={String(itemsPerPage)}
                onValueChange={(value) => setItemsPerPage(Number(value))}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={String(itemsPerPage)} />
                </SelectTrigger>
                <SelectContent side="top">
                  {itemsPerPageOptions.map((pageSize) => (
                    <SelectItem key={pageSize} value={String(pageSize)}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Pagination className="w-auto mx-0">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className={
                      currentPage === 1
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>
                {generatePaginationItems(currentPage, totalPages).map(
                  (page, i) => (
                    <PaginationItem key={i}>
                      {page === "..." ? (
                        <PaginationEllipsis />
                      ) : (
                        <PaginationLink
                          isActive={page === currentPage}
                          onClick={() => setCurrentPage(page as number)}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      )}
                    </PaginationItem>
                  ),
                )}
                <PaginationItem>
                  <PaginationNext
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    className={
                      currentPage === totalPages
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      )}
    </div>
  );
}

function generatePaginationItems(
  currentPage: number,
  totalPages: number,
): (number | string)[] {
  const items: (number | string)[] = [];
  const maxVisible = 5;

  if (totalPages <= maxVisible) {
    for (let i = 1; i <= totalPages; i++) items.push(i);
  } else {
    if (currentPage <= 3) {
      for (let i = 1; i <= 3; i++) items.push(i);
      items.push("...");
      items.push(totalPages);
    } else if (currentPage >= totalPages - 2) {
      items.push(1);
      items.push("...");
      for (let i = totalPages - 2; i <= totalPages; i++) items.push(i);
    } else {
      items.push(1);
      items.push("...");
      items.push(currentPage);
      items.push("...");
      items.push(totalPages);
    }
  }
  return items;
}

function ResourceTableWithColumns<T>({
  data,
  columns,
  sortKey,
  sortDirection,
  onSort,
  onRowClick,
}: {
  data: T[];
  columns: TableColumn<T>[];
  sortKey?: string;
  sortDirection?: "asc" | "desc" | null;
  onSort?: (key: string) => void;
  onRowClick?: (item: T) => void;
}) {
  return (
    <ResourceTable
      columns={columns}
      data={data}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={onSort}
      onRowClick={onRowClick}
    />
  );
}

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
}: CollectionsListProps<T>) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Spinner />
      </div>
    );
  }

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
        ) : viewMode === "cards" ? (
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            }}
          >
            {data.map((item) => (
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
            data={data}
            columns={columns}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={onSort}
            onRowClick={onItemClick}
          />
        ) : schema ? (
          <CollectionTable
            data={data}
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
    </div>
  );
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

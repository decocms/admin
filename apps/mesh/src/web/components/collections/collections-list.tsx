import type { BaseCollectionEntity } from "@decocms/bindings/collections";
import { Card } from "@deco/ui/components/card.tsx";
import { CollectionCard } from "./collection-card.tsx";
import { CollectionTableWrapper } from "./collection-table-wrapper.tsx";
import { CollectionDisplayButton } from "./collection-display-button.tsx";
import type { CollectionsListProps } from "./types";
import type { TableColumn } from "@deco/ui/components/collection-table.tsx";
import { EmptyState } from "@deco/ui/components/empty-state.tsx";
import { z } from "zod";

export function CollectionsList<T extends BaseCollectionEntity>({
  data,
  schema,
  viewMode,
  onViewModeChange,
  search,
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
  sortableFields,
}: CollectionsListProps<T>) {
  const handleAction = (
    action: "open" | "delete" | "duplicate" | "edit",
    item: T,
  ) => {
    onAction?.(action, item);
  };

  // Generate sort options from columns or schema
  const sortOptions = columns
    ? columns
        .filter((col) => col.sortable !== false)
        .filter((col) => !sortableFields || sortableFields.includes(col.id))
        .map((col) => ({
          id: col.id,
          label: typeof col.header === "string" ? col.header : col.id,
        }))
    : schema
      ? Object.keys(schema.shape)
          .filter((key) => {
            // Filter out internal fields
            if (
              [
                "id",
                "created_at",
                "updated_at",
                "created_by",
                "updated_by",
                "organization_id",
              ].includes(key)
            ) {
              return false;
            }
            // If sortableFields is provided, only include those
            if (sortableFields) {
              return sortableFields.includes(key);
            }
            return true;
          })
          .map((key) => ({
            id: key,
            label:
              key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " "),
          }))
      : [];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header with actions */}
      {!hideToolbar && (
        <div className="shrink-0 w-full border-b border-border h-12">
          <div className="flex items-center gap-3 h-12 px-4">
            <div className="flex items-center gap-2 flex-1">
              {headerActions}
            </div>

            {/* View Mode + Sort Controls */}
            <div className="flex items-center gap-2 shrink-0">
              <CollectionDisplayButton
                viewMode={viewMode}
                onViewModeChange={onViewModeChange}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={onSort}
                sortOptions={sortOptions}
              />
            </div>
          </div>
        </div>
      )}

      {/* Content: Cards or Table */}
      {viewMode === "cards" ? (
        <div className="flex-1 overflow-auto p-5">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-muted-foreground">Loading...</div>
            </div>
          ) : data.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              {emptyState || (
                <EmptyState
                  icon="inbox"
                  title="No items found"
                  description={
                    search ? "Try adjusting your search" : "No items to display"
                  }
                />
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                  ) : (
                    <Card className="p-6">
                      <h3 className="font-medium">{item.title}</h3>
                    </Card>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <CollectionTableWrapper
          columns={
            columns ||
            (schema ? generateColumnsFromSchema(schema, sortableFields) : [])
          }
          data={data}
          isLoading={isLoading}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={onSort}
          onRowClick={onItemClick}
          emptyState={
            emptyState || (
              <EmptyState
                icon="inbox"
                title="No items found"
                description={
                  search ? "Try adjusting your search" : "No items to display"
                }
              />
            )
          }
        />
      )}
    </div>
  );
}

// Helper to generate columns from schema
function generateColumnsFromSchema<T extends BaseCollectionEntity>(
  schema: z.AnyZodObject,
  sortableFields?: string[],
): TableColumn<T>[] {
  return Object.keys(schema.shape)
    .filter(
      (key) => !["organization_id", "created_by", "updated_by"].includes(key),
    )
    .map((key) => {
      // Determine if this field should be sortable
      const isSortable = sortableFields
        ? sortableFields.includes(key)
        : !["id"].includes(key); // By default, all fields except 'id' are sortable

      // Handle date fields
      if (key.endsWith("_at")) {
        return {
          id: key,
          header: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " "),
          render: (row) => {
            const val = row[key as keyof T];
            if (!val) return "—";
            return new Date(val as string).toLocaleDateString();
          },
          sortable: isSortable,
        };
      }

      return {
        id: key,
        header: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " "),
        render: (row) => {
          const val = row[key as keyof T];
          if (val === null || val === undefined) return "—";
          if (typeof val === "object") return JSON.stringify(val);
          return String(val);
        },
        sortable: isSortable,
      };
    });
}

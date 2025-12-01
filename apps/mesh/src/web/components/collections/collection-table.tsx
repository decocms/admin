import {
  Table as ResourceTable,
  type TableColumn,
} from "@deco/ui/components/resource-table.tsx";
import type { BaseCollectionEntity } from "@decocms/bindings/collections";
import type { z } from "zod";
import { UserIndicator } from "./user-indicator.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";

interface CollectionTableProps<T extends BaseCollectionEntity> {
  data: T[];
  schema: z.AnyZodObject;
  readOnly?: boolean;
  onAction: (action: "open" | "delete" | "duplicate", item: T) => void;
  sortKey?: string;
  sortDirection?: "asc" | "desc" | null;
  onSort?: (key: string) => void;
  onRowClick?: (item: T) => void;
}

export function CollectionTable<T extends BaseCollectionEntity>({
  data,
  schema,
  readOnly,
  onAction,
  sortKey,
  sortDirection,
  onSort,
  onRowClick,
}: CollectionTableProps<T>) {
  // Generate columns from schema
  const columns: TableColumn<T>[] = Object.keys(schema.shape).map((key) => {
    const isUpdatedBy = key === "updated_by";
    const isCreatedBy = key === "created_by";

    if (isUpdatedBy || isCreatedBy) {
      return {
        header: key,
        id: key,
        render: (row) => (
          <UserIndicator userId={row[key as keyof T] as string} />
        ),
      };
    }

    // Handle Date fields if schema indicates datetime (not easily detectable without inspecting checks)
    // For now, just render as string, or assume *_at fields are dates
    if (key.endsWith("_at")) {
      return {
        header: key,
        id: key,
        render: (row) => {
          const val = row[key as keyof T];
          if (!val) return "-";
          return new Date(val as string).toLocaleString();
        },
      };
    }

    return {
      header: key,
      id: key,
      render: (row) => {
        const val = row[key as keyof T];
        let displayValue: string;

        if (typeof val === "object" && val !== null) {
          displayValue = JSON.stringify(val);
        } else {
          displayValue = String(val ?? "");
        }

        return (
          <div className="truncate max-w-[100ch]" title={displayValue}>
            {displayValue}
          </div>
        );
      },
    };
  });

  // Add Actions column
  columns.push({
    header: "",
    id: "actions",
    render: (row) => (
      <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Icon name="more_vert" size={16} />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onAction("open", row)}>
              <Icon name="visibility" className="mr-2 h-4 w-4" />
              Open
            </DropdownMenuItem>
            {!readOnly && (
              <>
                <DropdownMenuItem onClick={() => onAction("duplicate", row)}>
                  <Icon name="content_copy" className="mr-2 h-4 w-4" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onAction("delete", row)}
                  className="text-destructive focus:text-destructive"
                >
                  <Icon name="delete" className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ),
  });

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

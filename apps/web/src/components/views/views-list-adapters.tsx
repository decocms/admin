import type { ViewWithStatus } from "./list.tsx";
import type { TableColumn } from "@deco/ui/components/resource-table.tsx";
import { TimeAgoCell } from "../common/table/table-cells.tsx";
import type { CustomRowAction } from "../resources-v2/list.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";

/**
 * Adapter to transform ViewWithStatus to a format compatible with ResourcesV2List
 */
export function adaptView(view: ViewWithStatus): Record<string, unknown> {
  const viewId = `${view.integration.id}/${view.name ?? "index"}`;
  return {
    id: viewId,
    uri: `legacy-view://${viewId}`,
    // For compatibility with ResourceListItem structure
    data: {
      name: view.title || "Untitled view",
      description: view.integration.name || "",
    },
    created_at: new Date().toISOString(), // Views don't have timestamps
    updated_at: new Date().toISOString(),
    // Store original view for row actions
    _view: view,
  };
}

/**
 * Get columns for views table - matches ResourcesV2List style
 */
export function getViewsColumns(): TableColumn<Record<string, unknown>>[] {
  return [
    {
      id: "title",
      header: "Name",
      render: (row) => {
        const item = row as Record<string, unknown>;
        const view =
          (item._view as ViewWithStatus) || (item as unknown as ViewWithStatus);
        return (
          <div className="flex items-center gap-2 min-h-8 font-medium">
            <Icon
              name={view.icon.toLowerCase()}
              className="shrink-0"
              size={20}
            />
            <span className="truncate">{view.title}</span>
          </div>
        );
      },
      cellClassName: "max-w-3xs",
      sortable: true,
    },
    {
      id: "description",
      header: "Integration",
      accessor: (row) => {
        const item = row as Record<string, unknown>;
        const view =
          (item._view as ViewWithStatus) || (item as unknown as ViewWithStatus);
        return view.integration.name;
      },
      cellClassName: "max-w-md",
      sortable: true,
    },
    {
      id: "updated_at",
      header: "Updated",
      render: (row) => {
        const item = row as Record<string, unknown>;
        return <TimeAgoCell value={item.updated_at as string} />;
      },
      cellClassName: "whitespace-nowrap min-w-30",
      sortable: true,
    },
  ];
}

/**
 * Get custom row actions for views (none - pin/unpin is handled in the card)
 */
export function getViewRowActions(): (
  item: Record<string, unknown>,
) => CustomRowAction[] {
  return () => {
    // Views don't have row actions - pin/unpin is handled in the card
    return [];
  };
}

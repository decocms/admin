import {
  buildAddViewPayload,
  findPinnedView,
  useAddView,
  useIntegrationViews,
  useRemoveView,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useDeferredValue, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { usePinnedTabs } from "../../hooks/use-pinned-tabs.ts";
import { EmptyState } from "@deco/ui/components/empty-state.tsx";
import {
  Table,
  type TableColumn,
} from "@deco/ui/components/resource-table.tsx";
import { useThread } from "../decopilot/thread-provider.tsx";
import { ResourceHeader } from "@deco/ui/components/resource-header.tsx";
import { useCurrentTeam } from "../sidebar/team-selector";

export interface ViewWithStatus {
  isAdded: boolean;
  teamViewId?: string;
  name?: string;
  url?: string;
  title: string;
  icon: string;
  integration: {
    id: string;
    name: string;
    icon?: string;
    description?: string;
  };
  rules?: string[];
}

function TableView({
  views,
  onConfigure,
}: {
  views: ViewWithStatus[];
  onConfigure: (view: ViewWithStatus) => void;
}) {
  const [sortKey, setSortKey] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  function getSortValue(row: ViewWithStatus): string {
    return row.title?.toLowerCase() || "";
  }
  const sortedViews = [...views].sort((a, b) => {
    const aVal = getSortValue(a);
    const bVal = getSortValue(b);
    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const columns: TableColumn<ViewWithStatus>[] = [
    {
      id: "name",
      header: "Name",
      sortable: true,
      render: (view) => (
        <div className="flex items-center gap-2 min-h-8 font-medium">
          <Icon name={view.icon.toLowerCase()} className="shrink-0" size={20} />
          <span className="truncate">{view.title}</span>
        </div>
      ),
    },
    {
      id: "integration",
      header: "Integration",
      accessor: (view) => view.integration.name,
      sortable: true,
      cellClassName: "max-w-md",
    },
    {
      id: "pin",
      header: "Added",
      render: (view) => (
        <div className="flex items-center gap-2">
          <TogglePin view={view} />
          {view.isAdded && <PinToSidebar view={view} />}
        </div>
      ),
    },
  ];

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  return (
    <Table
      columns={columns}
      data={sortedViews}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={handleSort}
      onRowClick={onConfigure}
    />
  );
}

export function TogglePin({ view }: { view: ViewWithStatus }) {
  const removeViewMutation = useRemoveView();
  const addViewMutation = useAddView();

  const handleAddView = async (view: ViewWithStatus) => {
    try {
      await addViewMutation.mutateAsync({
        view: buildAddViewPayload({
          view: {
            name: view.name,
            title: view.title,
            icon: view.icon,
            url: view.url,
          },
          integrationId: view.integration.id,
        }),
      });

      toast.success(`View "${view.title}" added successfully`);
    } catch (error) {
      console.error("Error adding view:", error);
      toast.error(`Failed to add view "${view.title}"`);
    }
  };

  const handleRemoveView = async (viewWithStatus: ViewWithStatus) => {
    if (!viewWithStatus.teamViewId) {
      toast.error("No view to remove");
      return;
    }

    try {
      await removeViewMutation.mutateAsync({
        viewId: viewWithStatus.teamViewId,
      });

      toast.success(`View "${viewWithStatus.title}" removed successfully`);
    } catch (error) {
      console.error("Error removing view:", error);
      toast.error(`Failed to remove view "${viewWithStatus.title}"`);
    }
  };

  return (
    <>
      {view.isAdded ? (
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            handleRemoveView(view);
          }}
          disabled={removeViewMutation.isPending}
        >
          {removeViewMutation.isPending ? (
            <Icon name="hourglass_empty" size={14} />
          ) : (
            <Icon name="remove" size={14} />
          )}
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleAddView(view);
          }}
          disabled={addViewMutation.isPending}
        >
          {addViewMutation.isPending ? (
            <Icon name="hourglass_empty" size={14} />
          ) : (
            <Icon name="add" size={14} />
          )}
        </Button>
      )}
    </>
  );
}

function PinToSidebar({ view }: { view: ViewWithStatus }) {
  const { org, project } = useParams();
  const projectKey = org && project ? `${org}/${project}` : undefined;
  const { togglePin, isPinned } = usePinnedTabs(projectKey);

  if (!view.teamViewId) {
    return null;
  }

  const viewId = view.teamViewId;
  // Build resourceUri for the view
  const resourceUri = `view://${view.integration.id}/${viewId}`;
  const isPinnedToSidebar = isPinned(resourceUri);

  const handleTogglePin = (e: React.MouseEvent) => {
    e.stopPropagation();

    togglePin({
      resourceUri,
      title: view.title,
      type: "list", // Views are typically list views
      icon: view.icon.toLowerCase(),
    });

    if (isPinnedToSidebar) {
      toast.success(`View "${view.title}" unpinned from sidebar`);
    } else {
      toast.success(`View "${view.title}" pinned to sidebar`);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleTogglePin}
      title={isPinnedToSidebar ? "Unpin from sidebar" : "Pin to sidebar"}
    >
      <Icon
        name={isPinnedToSidebar ? "keep_off" : "keep"}
        size={14}
        className={isPinnedToSidebar ? "" : "opacity-50"}
      />
    </Button>
  );
}

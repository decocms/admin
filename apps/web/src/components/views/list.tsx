import { useAddView, useRemoveView, useIntegrationViews } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@deco/ui/components/dialog.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import { useViewMode } from "@deco/ui/hooks/use-view-mode.ts";
import { cn } from "@deco/ui/lib/utils.ts";
import { useDeferredValue, useMemo, useState } from "react";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { EmptyState } from "../common/empty-state.tsx";
import { ListPageHeader } from "../common/list-page-header.tsx";
import { Table, TableColumn } from "../common/table/index.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";
import { useCurrentTeam } from "../sidebar/team-selector";
import { IntegrationAvatar } from "../common/avatar/integration.tsx";

export interface ViewWithStatus {
  isAdded: boolean;
  teamViewId?: string;
  url: string;
  title: string;
  icon: string;
  integration?: {
    id: string;
    name: string;
    icon?: string;
    description?: string;
  };
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
      accessor: (view) => view.integration?.name,
      sortable: true,
      cellClassName: "max-w-md",
    },
    {
      id: "pin",
      header: "Added",
      render: (view) => (
        <div>
          <TogglePin view={view} />
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

function TogglePin({ view }: { view: ViewWithStatus }) {
  const removeViewMutation = useRemoveView();
  const addViewMutation = useAddView();

  const handleAddView = async (view: ViewWithStatus) => {
    try {
      await addViewMutation.mutateAsync({
        view: {
          id: crypto.randomUUID(),
          title: view.title,
          icon: view.icon,
          type: "custom" as const,
          url: view.url,
        },
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

function AddCustomViewModal() {
  const [open, setOpen] = useState(false);
  const [customViewName, setCustomViewName] = useState("");
  const [customViewUrl, setCustomViewUrl] = useState("");
  const addViewMutation = useAddView();

  const handleCustomViewAdd = async () => {
    if (!customViewName.trim() || !customViewUrl.trim()) {
      return;
    }

    try {
      await addViewMutation.mutateAsync({
        view: {
          id: crypto.randomUUID(),
          title: customViewName.trim(),
          icon: "dashboard",
          type: "custom" as const,
          url: customViewUrl.trim(),
        },
      });

      toast.success(
        `Custom view "${customViewName.trim()}" added successfully`,
      );

      // Reset form and close modal
      setCustomViewName("");
      setCustomViewUrl("");
      setOpen(false);
    } catch (error) {
      console.error("Error adding custom view:", error);
      toast.error(`Failed to add custom view "${customViewName.trim()}"`);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset form when closing
      setCustomViewName("");
      setCustomViewUrl("");
    }
  };

  return (
    <div>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button variant="special" className="w-full">
            <Icon name="add" size={16} />
            New view
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <DialogTitle>Add Custom View</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">View Name</label>
              <Input
                placeholder="Enter view name..."
                value={customViewName}
                onChange={(e) => setCustomViewName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">View URL</label>
              <Input
                placeholder="Enter view URL..."
                value={customViewUrl}
                onChange={(e) => setCustomViewUrl(e.target.value)}
              />
            </div>

            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCustomViewAdd}
                disabled={
                  !customViewName.trim() ||
                  !customViewUrl.trim() ||
                  addViewMutation.isPending
                }
                className="flex-1"
              >
                {addViewMutation.isPending ? (
                  <Icon name="hourglass_empty" size={16} />
                ) : (
                  <Icon name="add" size={16} />
                )}
                Add View
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ViewCard({
  view,
  handleViewClick,
}: {
  view: ViewWithStatus;
  handleViewClick: (view: ViewWithStatus) => void;
}) {
  return (
    <Card
      className={cn("hover:shadow-md transition-shadow cursor-pointer")}
      onClick={() => handleViewClick(view)}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Icon
            name={view.icon.toLowerCase()}
            className="w-6 h-6 shrink-0"
            size={24}
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{view.title}</h3>
          </div>
          <TogglePin view={view} />
        </div>
        {view.integration && (
          <div className="flex gap-2 items-center mt-3 pt-3 border-t border-border">
            <IntegrationAvatar
              url={view.integration.icon}
              fallback={view.integration.name}
              size="xs"
              className="flex-shrink-0"
            />
            <p className="text-sm text-muted-foreground truncate">
              {view.integration.name}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ViewsList() {
  const currentTeam = useCurrentTeam();
  const navigateWorkspace = useNavigateWorkspace();
  const [viewMode, setViewMode] = useViewMode();
  const { data: views = [] } = useIntegrationViews({});
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const customViews = currentTeam.views
    .map((view) => {
      const isFromIntegration = views.some((v) => v.url === view.metadata.url);
      if (isFromIntegration) {
        return;
      }
      if (view.type === "custom") {
        return {
          ...view,
          isAdded: true,
          integration: undefined,
          url: view.metadata.url as string,
          teamViewId: view?.id,
        };
      }
      return;
    })
    .filter(Boolean);

  const allViews = useMemo(() => {
    return views.map((view) => {
      const existingView = currentTeam.views.find((teamView) => {
        const metadata = teamView.metadata as { url?: string };
        return metadata?.url === view.url;
      });
      return {
        ...view,
        isAdded: !!existingView,
        teamViewId: existingView?.id,
      };
    });
  }, [currentTeam]);

  // Filter views based on deferred search term for better performance
  const filteredViews = useMemo(() => {
    if (!deferredSearchTerm) return allViews;

    const lowercaseSearch = deferredSearchTerm.toLowerCase();
    return allViews.filter(
      (view) =>
        view.title?.toLowerCase().includes(lowercaseSearch) ||
        view.integration.name.toLowerCase().includes(lowercaseSearch),
    );
  }, [allViews, deferredSearchTerm]);

  const handleViewClick = (view: ViewWithStatus) => {
    if (view.isAdded) {
      navigateWorkspace(`/views/${view.teamViewId}`);
    } else {
      navigateWorkspace(`/views/${crypto.randomUUID()}?url=${view.url}`);
    }
  };

  return (
    <div className="flex flex-col h-full p-4">
      <ListPageHeader
        input={{
          placeholder: "Search views",
          value: searchTerm,
          onChange: (e) => setSearchTerm(e.target.value),
        }}
        view={{ viewMode, onChange: setViewMode }}
      />

      {filteredViews.length > 0 && viewMode === "cards" && (
        <div>
          <div className="text-sm font-bold">From integrations</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 py-4">
            {filteredViews.map((view) => (
              <ViewCard
                key={`${view.integration.id}-${view.title}`}
                view={view}
                handleViewClick={handleViewClick}
              />
            ))}
          </div>
        </div>
      )}

      {
        <div>
          <div className="text-sm font-bold">Custom</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 py-4">
            {customViews.map(
              (view) =>
                view && (
                  <ViewCard
                    key={`${view.title}`}
                    view={{
                      ...view,
                      isAdded: true,
                      integration: undefined,
                      url: view.metadata.url as string,
                      teamViewId: view?.id,
                    }}
                    handleViewClick={handleViewClick}
                  />
                ),
            )}
          </div>
        </div>
      }

      {filteredViews.length > 0 && viewMode === "table" && (
        <TableView views={filteredViews} onConfigure={handleViewClick} />
      )}

      {filteredViews.length === 0 && (
        <EmptyState
          icon="dashboard"
          title="No views found"
          description={
            deferredSearchTerm
              ? "No views match your search."
              : "No view tools are available from your integrations."
          }
        />
      )}
    </div>
  );
}

const TABS = {
  list: {
    Component: ViewsList,
    title: "Views",
    initialOpen: true,
  },
};

export default function Page() {
  return (
    <PageLayout
      tabs={TABS}
      hideViewsButton
      actionButtons={<AddCustomViewModal />}
      breadcrumb={
        <DefaultBreadcrumb items={[{ label: "Views", link: "/views" }]} />
      }
    />
  );
}

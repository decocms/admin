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

interface ViewsListProps {
  searchTerm?: string;
  viewMode?: "cards" | "table";
  tabs?: Array<{ id: string; label: string; onClick: () => void }>;
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  headerSlot?: React.ReactNode;
}

function ViewsList({
  searchTerm = "",
  viewMode = "cards",
  tabs,
  activeTab,
  onTabChange,
  headerSlot,
}: ViewsListProps) {
  const currentTeam = useCurrentTeam();
  const navigateWorkspace = useNavigateWorkspace();
  const { data: views = [], isLoading: isLoadingViews } = useIntegrationViews(
    {},
  );
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const allViews = useMemo(() => {
    return views.map((view) => {
      const existingView = findPinnedView(
        currentTeam.views,
        view.integration.id,
        { name: view.name },
      );
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

  const beautifyViewName = (text: string) => {
    return text
      .replace("DECO_CHAT_VIEW_", "")
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const { createTab } = useThread();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleViewClick = (view: ViewWithStatus) => {
    // Open in canvas tab instead of navigating
    // Create a unique view ID for the legacy view
    const viewId = `${view.integration.id}/${view.name ?? "index"}`;
    const newTab = createTab({
      type: "detail",
      resourceUri: `legacy-view://${viewId}`,
      title: view.title || "Untitled",
      icon: view.icon.toLowerCase(),
    });
    if (!newTab) {
      console.warn("[ViewsListLegacy] No active tab found");
      const qs = view.url ? `?viewUrl=${encodeURIComponent(view.url)}` : "";
      navigateWorkspace(
        `/views/${view.integration.id}/${view.name ?? "index"}${qs}`,
      );
    }
  };

  const q = searchParams.get("q") ?? "";

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto">
        {/* Header Section */}
        <div className="sticky">
          <div className="px-8">
            <div className="max-w-[1600px] mx-auto w-full space-y-4 md:space-y-6 lg:space-y-8">
              {headerSlot}
              <ResourceHeader
                tabs={tabs ?? []}
                activeTab={activeTab ?? "legacy"}
                onTabChange={onTabChange}
                searchValue={q}
                onSearchChange={(value: string) => {
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev);
                    if (value) next.set("q", value);
                    else next.delete("q");
                    return next;
                  });
                }}
                onSearchBlur={() => {
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev);
                    next.delete("q");
                    return next;
                  });
                }}
                onSearchKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === "Escape") {
                    setSearchParams((prev) => {
                      const next = new URLSearchParams(prev);
                      next.delete("q");
                      return next;
                    });
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                viewMode={viewMode}
                onViewModeChange={() => {}} // View mode is managed by parent
              />
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="px-8">
          <div className="max-w-[1600px] mx-auto w-full space-y-4 md:space-y-6 lg:space-y-8 pb-8">
            {isLoadingViews && (
              <div className="flex justify-center items-center py-8">
                <Spinner />
              </div>
            )}

            {filteredViews.length > 0 && viewMode === "cards" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredViews.map((view) => (
                  <Card
                    key={`${view.integration.id}-${view.title}`}
                    className={cn(
                      "group cursor-pointer hover:shadow-sm transition-shadow overflow-hidden bg-card border-0 min-h-48",
                    )}
                    onClick={() => handleViewClick(view)}
                  >
                    <CardContent className="p-5 h-full">
                      <div className="flex items-center gap-3 h-full">
                        <Icon
                          name={view.icon.toLowerCase()}
                          className="w-6 h-6 shrink-0"
                          size={24}
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate text-base">
                            {beautifyViewName(view.title || "")}
                          </h3>
                          <p className="text-sm text-muted-foreground truncate">
                            {view.integration.name}
                          </p>
                        </div>
                        <div
                          className="flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <TogglePin view={view} />
                          {view.isAdded && <PinToSidebar view={view} />}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {filteredViews.length > 0 && viewMode === "table" && (
              <div className="w-fit min-w-full">
                <TableView
                  views={filteredViews}
                  onConfigure={handleViewClick}
                />
              </div>
            )}

            {filteredViews.length === 0 && !isLoadingViews && (
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
        </div>
      </div>
    </div>
  );
}


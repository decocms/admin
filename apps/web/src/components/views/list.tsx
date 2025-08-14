import {
  MCPConnection,
  useAddView,
  useBindingIntegrations,
  useConnectionViews,
  useRemoveView,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
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

interface ViewWithStatus {
  isAdded: boolean;
  teamViewId?: string;
  url: string;
  title: string;
  icon: string;
  integration: {
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
      accessor: (view) => view.integration.name,
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

// Helper component to handle individual integration view loading
function IntegrationViews({
  integration,
  onViewsLoaded,
}: {
  integration: {
    id: string;
    name: string;
    icon?: string;
    connection: MCPConnection;
    description?: string;
  };
  onViewsLoaded: (
    integrationId: string,
    views: {
      url: string;
      title: string;
      icon: string;
    }[],
    isLoading: boolean,
  ) => void;
}) {
  const { data: viewsData, isLoading } = useConnectionViews({
    id: integration.id,
    connection: integration.connection,
  });

  // Notify parent component when views are loaded or loading state changes
  useMemo(() => {
    if (!viewsData?.views) return;
    onViewsLoaded(integration.id, viewsData?.views, isLoading);
  }, [integration.id, viewsData?.views, isLoading, onViewsLoaded]);

  return null; // This component doesn't render anything
}

function ViewsList() {
  const currentTeam = useCurrentTeam();
  const navigateWorkspace = useNavigateWorkspace();
  const [viewMode, setViewMode] = useViewMode();
  const { data: integrations = [] } = useBindingIntegrations("View");
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);

  // Track views and loading states for all integrations
  const [integrationViews, setIntegrationViews] = useState<
    Record<
      string,
      {
        views: {
          url: string;
          title: string;
          icon: string;
        }[];
        isLoading: boolean;
      }
    >
  >({});

  const handleViewsLoaded = useMemo(
    () =>
      (
        integrationId: string,
        views: {
          url: string;
          title: string;
          icon: string;
        }[],
        isLoading: boolean,
      ) => {
        setIntegrationViews((prev) => ({
          ...prev,
          [integrationId]: { views, isLoading },
        }));
      },
    [],
  );

  // Combine all views with their integration info
  const allViews = useMemo(() => {
    return integrations.flatMap((integration) => {
      const data = integrationViews[integration.id];
      const views = data?.views || [];
      return views.map((view) => {
        const existingView = currentTeam.views.find((teamView) => {
          const metadata = teamView.metadata as { url?: string };
          return metadata?.url === view.url;
        });
        return {
          ...view,
          isAdded: !!existingView,
          teamViewId: existingView?.id,
          integration: {
            id: integration.id,
            name: integration.name,
            icon: integration.icon,
            description: integration.description,
          },
        };
      });
    });
  }, [integrations, integrationViews, currentTeam]);

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

  // Check if any integration is still loading
  const isLoading = Object.values(integrationViews).some(
    (data) => data.isLoading,
  );

  const beautifyViewName = (text: string) => {
    return text
      .replace("DECO_CHAT_VIEW_", "")
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const handleViewClick = (view: ViewWithStatus) => {
    if (view.isAdded) {
      navigateWorkspace(`/views/${view.teamViewId}`);
    } else {
      navigateWorkspace(`/views/${crypto.randomUUID()}?url=${view.url}`);
    }
  };

  return (
    <div className="flex flex-col h-full p-4">
      {/* Hidden components that handle individual integration view loading */}
      {integrations.map((integration) => (
        <IntegrationViews
          key={integration.id}
          integration={integration}
          onViewsLoaded={handleViewsLoaded}
        />
      ))}

      <ListPageHeader
        input={{
          placeholder: "Search views",
          value: searchTerm,
          onChange: (e) => setSearchTerm(e.target.value),
        }}
        view={{ viewMode, onChange: setViewMode }}
      />

      {/* Show loading indicator if still loading some views */}
      {isLoading && allViews.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading views...</div>
        </div>
      )}

      {isLoading && allViews.length > 0 && (
        <div className="p-2 text-sm text-muted-foreground text-center border-b">
          Loading additional views...
        </div>
      )}

      {filteredViews.length > 0 && viewMode === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 py-4">
          {filteredViews.map((view) => (
            <Card
              key={`${view.integration.id}-${view.title}`}
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
                    <h3 className="font-medium truncate">
                      {beautifyViewName(view.title || "")}
                    </h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {view.integration.name}
                    </p>
                  </div>
                  <TogglePin view={view} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filteredViews.length > 0 && viewMode === "table" && (
        <TableView views={filteredViews} onConfigure={handleViewClick} />
      )}

      {filteredViews.length === 0 && !isLoading && (
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
      breadcrumb={
        <DefaultBreadcrumb items={[{ label: "Views", link: "/views" }]} />
      }
    />
  );
}

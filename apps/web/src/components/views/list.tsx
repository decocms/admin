import { useAddView, useAgents, useBindingIntegrations, useConnectionViews, useRemoveView } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import { useViewMode } from "@deco/ui/hooks/use-view-mode.ts";
import { useDeferredValue, useMemo, useState } from "react";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { EmptyState } from "../common/empty-state.tsx";
import { ListPageHeader } from "../common/list-page-header.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";
import { useCurrentTeam } from "../sidebar/team-selector";

// Helper component to handle individual integration view loading
function IntegrationViews({ integration, onViewsLoaded }: { 
  integration: { id: string; connection: any; name: string; icon?: string; description?: string };
  onViewsLoaded: (integrationId: string, views: any[], isLoading: boolean) => void;
}) {
  const { data: viewsData, isLoading } = useConnectionViews({
    id: integration.id,
    connection: integration.connection
  });

  // Notify parent component when views are loaded or loading state changes
  useMemo(() => {
    onViewsLoaded(integration.id, viewsData?.views || [], isLoading);
  }, [integration.id, viewsData?.views, isLoading, onViewsLoaded]);

  return null; // This component doesn't render anything
}

function ViewsList() {
  const currentTeam = useCurrentTeam();
  const navigateWorkspace = useNavigateWorkspace();
  const [viewMode, setViewMode] = useViewMode();
  const { data: agents } = useAgents();
  console.log("agents", agents);
  const { data: integrations = [] } = useBindingIntegrations("View");
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const addViewMutation = useAddView();
  const removeViewMutation = useRemoveView();
  
  // Track views and loading states for all integrations
  const [integrationViews, setIntegrationViews] = useState<Record<string, { views: any[]; isLoading: boolean }>>({});
  
  const handleViewsLoaded = useMemo(() => (integrationId: string, views: any[], isLoading: boolean) => {
    setIntegrationViews(prev => ({
      ...prev,
      [integrationId]: { views, isLoading }
    }));
  }, []);

  // Combine all views with their integration info
  const allViews = useMemo(() => {
    return integrations.flatMap(integration => {
      const data = integrationViews[integration.id];
      const views = data?.views || [];
      return views.map((view: any) => {
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
        }
      }});
    });
  }, [integrations, integrationViews, currentTeam]);

  // Filter views based on deferred search term for better performance
  const filteredViews = useMemo(() => {
    if (!deferredSearchTerm) return allViews;
    
    const lowercaseSearch = deferredSearchTerm.toLowerCase();
    return allViews.filter(view => 
      view.title?.toLowerCase().includes(lowercaseSearch) ||
      view.integration.name.toLowerCase().includes(lowercaseSearch)
    );
  }, [allViews, deferredSearchTerm]);

  // Check if any integration is still loading
  const isLoading = Object.values(integrationViews).some(data => data.isLoading);

  const handleAddView = async (view: (typeof allViews)[0]) => {
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

  const handleRemoveView = async (
    viewWithStatus: (typeof allViews)[0],
  ) => {
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

  const beautifyViewName = (text: string) => {
    return text
      .replace("DECO_CHAT_VIEW_", "")
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="flex flex-col h-full">
      {/* Hidden components that handle individual integration view loading */}
      {integrations.map(integration => (
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

      {filteredViews.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
        {filteredViews.map((view) => (
          <Card key={`${view.integration.id}-${view.title}`} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Icon
                  name={view.icon.toLowerCase()}
                  className="w-6 h-6 shrink-0"
                  size={24}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">
                    {beautifyViewName(view.title || '')}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {view.integration.name}
                  </p>
                </div>
                {view.isAdded ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleRemoveView(view)}
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
                        onClick={() => handleAddView(view)}
                        disabled={addViewMutation.isPending}
                      >
                        {addViewMutation.isPending ? (
                          <Icon name="hourglass_empty" size={14} />
                        ) : (
                          <Icon name="add" size={14} />
                        )}
                      </Button>
                    )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      )}

      {filteredViews.length === 0 && !isLoading && (
        <EmptyState
          icon="dashboard"
          title="No views found"
          description={deferredSearchTerm ? "No views match your search." : "No view tools are available from your integrations."}
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
  const handleCreateView = () => {
    // TODO: Implement view creation
    console.log("Create view clicked");
  };

  return (
    <PageLayout
      tabs={TABS}
      hideViewsButton
      breadcrumb={
        <DefaultBreadcrumb items={[{ label: "Views", link: "/views" }]} />
      }
      actionButtons={
        <Button onClick={handleCreateView} variant="special" className="gap-2">
          <Icon name="add" />
          <span className="hidden md:inline">Create view</span>
        </Button>
      }
    />
  );
}

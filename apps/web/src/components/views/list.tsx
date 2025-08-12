import { useCurrentTeam } from "../sidebar/team-selector";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { EmptyState } from "../common/empty-state.tsx";
import { ListPageHeader } from "../common/list-page-header.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { useViewMode } from "@deco/ui/hooks/use-view-mode.ts";
import { parseViewMetadata } from "@deco/sdk";
import { useMemo } from "react";
import { Link } from "react-router";

function ViewsList() {
  const team = useCurrentTeam();
  const navigateWorkspace = useNavigateWorkspace();
  const [viewMode, setViewMode] = useViewMode();

  const views = useMemo(() => {
    return team.views.filter((view) => {
      const meta = parseViewMetadata(view);
      return meta?.type === "custom";
    });
  }, [team.views]);

  const handleCreateView = () => {
    // TODO: Implement view creation
    console.log("Create view clicked");
  };

  return (
    <div className="flex flex-col h-full">
      <ListPageHeader
        input={{
          placeholder: "Search views",
          value: "",
          onChange: () => {},
        }}
        view={{ viewMode, onChange: setViewMode }}
      />

      {views.length > 0 ? (
        <div className="flex-1 min-h-0 overflow-x-auto">
          {viewMode === "table" ? (
            <div className="p-4">
              <p className="text-muted-foreground">Table view coming soon...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {views.map((view) => {
                const meta = parseViewMetadata(view);
                if (!meta || meta.type !== "custom") return null;

                return (
                  <Card key={view.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Icon name={view.icon} className="w-8 h-8 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate">{view.title}</h3>
                          <p className="text-sm text-muted-foreground truncate">
                            Custom view
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon="dashboard"
          title="No views yet"
          description="You haven't created any custom views yet. Create one to get started."
          buttonProps={{
            children: "Create view",
            onClick: handleCreateView,
          }}
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

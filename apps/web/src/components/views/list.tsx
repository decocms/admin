import { useCurrentTeam } from "../sidebar/team-selector";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { EmptyState } from "../common/empty-state.tsx";
import { ListPageHeader } from "../common/list-page-header.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { useViewMode } from "@deco/ui/hooks/use-view-mode.ts";
import { useBindingIntegrations } from "@deco/sdk";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Input } from "@deco/ui/components/input.tsx";
import { IntegrationIcon } from "../integrations/common.tsx";
import { cn } from "@deco/ui/lib/utils.ts";

function ViewsList() {
  const team = useCurrentTeam();
  const navigateWorkspace = useNavigateWorkspace();
  const [viewMode, setViewMode] = useViewMode();
  const integrationsWithViews = useBindingIntegrations("View");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTools = useMemo(() => {
    if (!searchTerm) return tools;
    
    return tools.filter((tool) => {
      const toolName = tool.name.toLowerCase();
      const toolDescription = tool.description?.toLowerCase() || "";
      const integrationName = tool.integration.name.toLowerCase();
      const search = searchTerm.toLowerCase();
      
      return (
        toolName.includes(search) ||
        toolDescription.includes(search) ||
        integrationName.includes(search)
      );
    });
  }, [tools, searchTerm]);

  const handleCreateView = () => {
    // TODO: Implement view creation
    console.log("Create view clicked");
  };

  const beautifyToolName = (text: string) => {
    return text
      .replace("DECO_CHAT_VIEW_", "")
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="flex flex-col h-full">
      <ListPageHeader
        input={{
          placeholder: "Search views",
          value: searchTerm,
          onChange: (e) => setSearchTerm(e.target.value),
        }}
        view={{ viewMode, onChange: setViewMode }}
      />

      {filteredTools.length > 0 ? (
        <div className="flex-1 min-h-0 overflow-x-auto">
          {viewMode === "table" ? (
            <div className="p-4">
              <p className="text-muted-foreground">Table view coming soon...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {filteredTools.map((tool) => (
                <Card key={`${tool.integration.id}-${tool.name}`} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <IntegrationIcon
                        icon={tool.integration.icon}
                        name={tool.integration.name}
                        className="w-8 h-8 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">
                          {beautifyToolName(tool.name)}
                        </h3>
                        <p className="text-sm text-muted-foreground truncate">
                          {tool.integration.name}
                        </p>
                        {tool.description && (
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {tool.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon="dashboard"
          title="No views found"
          description={searchTerm ? "No views match your search." : "No view tools are available from your integrations."}
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

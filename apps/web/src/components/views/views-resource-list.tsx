import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "react-router";
import { useDecopilotOpen } from "../layout/decopilot-layout.tsx";
import { ResourcesV2List } from "../resources-v2/list.tsx";
import { useIntegrationViews, findPinnedView } from "@deco/sdk";
import { useCurrentTeam } from "../sidebar/team-selector";
import { useThread } from "../decopilot/thread-provider.tsx";
import {
  adaptView,
  getViewsColumns,
  getViewRowActions,
} from "./views-list-adapters.tsx";
import type { ViewWithStatus } from "./list.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { callTool, useIntegration } from "@deco/sdk";
import { GRID_VIEW_TEMPLATE, LIST_VIEW_TEMPLATE } from "./templates/index.ts";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Views resource list component that renders the ResourcesV2List
 * with the specific integration ID for views management
 */
export function ViewsResourceList({
  headerSlot,
}: {
  headerSlot?: ReactNode;
} = {}) {
  const [searchParams] = useSearchParams();
  const { setOpen: setDecopilotOpen } = useDecopilotOpen();

  // State-based tab management instead of route-based
  const [activeTab, setActiveTab] = useState<"all" | "legacy">("all");

  // Automatically open Decopilot if openDecopilot query param is present
  useEffect(() => {
    const openDecopilot = searchParams.get("openDecopilot") === "true";
    if (openDecopilot) {
      setDecopilotOpen(true);
    }
  }, [searchParams, setDecopilotOpen]);

  // All hooks must be called unconditionally at the top level
  const currentTeam = useCurrentTeam();
  const { data: views = [] } = useIntegrationViews({});
  const { createTab } = useThread();
  const integration = useIntegration("i:views-management").data;
  const queryClient = useQueryClient();

  const [isCreating, setIsCreating] = useState(false);

  const handleCreateImmediate = async (type: "blank" | "grid" | "list") => {
    setIsCreating(true);
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const resourceName = `${type}-view-${timestamp}`;
      const title = `${type.charAt(0).toUpperCase() + type.slice(1)} View ${timestamp.slice(-4)}`;

      let content = "";
      if (type === "grid") {
        content = GRID_VIEW_TEMPLATE;
      } else if (type === "list") {
        content = LIST_VIEW_TEMPLATE;
      } else {
        content = "export const App = () => <div>Hello World</div>;";
      }

      const response = await callTool(integration?.connection, {
        name: "DECO_RESOURCE_VIEW_CREATE",
        arguments: {
          data: {
            name: resourceName,
            description: `A ${type} view created via template`,
            code: content,
          }
        },
      });

      if (response.isError) {
        const content = response.content as Record<string, unknown>;
        const errorMessage =
          (content as unknown as Array<{ text?: string }>)?.[0]?.text ||
          "Failed to create resource";
        toast.error(errorMessage);
        return;
      }

      toast.success(`${title} created successfully`);

      // Invalidate queries to refresh list
      // The exact query key depends on how useIntegrationViews constructs it
      // For now, we rely on resource watch or manual refresh if needed
      // But we can try to invalidate generic resources list
      queryClient.invalidateQueries({ queryKey: ["resources"] });

    } catch (error) {
      console.error("Failed to create view:", error);
      toast.error("Failed to create view");
    } finally {
      setIsCreating(false);
    }
  };

  const customCtaButton = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="default" disabled={isCreating}>
          {isCreating ? <Icon name="hourglass_empty" className="animate-spin mr-2" /> : <Icon name="add" />}
          New view
          <Icon name="expand_more" className="ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleCreateImmediate("blank")}>
          <Icon name="article" className="mr-2" />
          Blank View
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleCreateImmediate("grid")}>
          <Icon name="grid_view" className="mr-2" />
          Grid View
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleCreateImmediate("list")}>
          <Icon name="list" className="mr-2" />
          List View
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const tabs = useMemo(
    () => [
      {
        id: "all",
        label: "All",
        onClick: () => setActiveTab("all"),
      },
      {
        id: "legacy",
        label: "Legacy",
        onClick: () => setActiveTab("legacy"),
      },
    ],
    [],
  );

  // Compute legacy views data unconditionally (hooks must be called at top level)
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
      } as ViewWithStatus;
    });
  }, [views, currentTeam]);

  const viewsItems = useMemo(() => allViews.map(adaptView), [allViews]);

  const handleViewClick = useCallback(
    (item: Record<string, unknown>) => {
      const view =
        (item._view as ViewWithStatus) || (item as unknown as ViewWithStatus);

      // Use rules directly from the view (from integration via useIntegrationViews)
      const viewId = `${view.integration.id}/${view.name ?? "index"}`;
      const newTab = createTab({
        type: "detail",
        resourceUri: `legacy-view://${viewId}`,
        title: view.title || "Untitled",
        icon: view.icon.toLowerCase(),
        rules: view.rules,
        integrationId: view.integration.id,
      });

      if (!newTab) {
        console.warn("[ViewsListLegacy] No active tab found");
      }
    },
    [createTab],
  );

  // Show legacy views if active tab is "legacy"
  if (activeTab === "legacy") {
    return (
      <ResourcesV2List
        integrationId="i:views-management"
        resourceName="view"
        headerSlot={headerSlot}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId as "all" | "legacy")}
        customData={viewsItems}
        customColumns={getViewsColumns()}
        customRowActions={getViewRowActions()}
        onItemClick={handleViewClick}
        customCtaButton={null}
        customEmptyState={{
          icon: "dashboard",
          title: "No views found",
          description: "No view tools are available from your integrations.",
        }}
      />
    );
  }

  return (
    <>
      <ResourcesV2List
        integrationId="i:views-management"
        resourceName="view"
        headerSlot={headerSlot}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId as "all" | "legacy")}
        customCtaButton={customCtaButton}
      />
    </>
  );
}

export default ViewsResourceList;

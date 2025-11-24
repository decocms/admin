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
import type { ViewWithStatus } from "./toggle-pin.tsx";

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
    <ResourcesV2List
      integrationId="i:views-management"
      resourceName="view"
      headerSlot={headerSlot}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(tabId) => setActiveTab(tabId as "all" | "legacy")}
    />
  );
}

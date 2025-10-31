import { type ReactNode, useEffect, useMemo } from "react";
import { useLocation, useSearchParams } from "react-router";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { useDecopilotOpen } from "../layout/decopilot-layout.tsx";
import { ResourcesV2List } from "../resources-v2/list.tsx";
import { useTrackNativeViewVisit, useSDK, type View } from "@deco/sdk";
import { useCurrentTeam } from "../sidebar/team-selector.tsx";
import { NEW_VIEW_PROMPT } from "@deco/sdk";

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
  const location = useLocation();
  const navigateWorkspace = useNavigateWorkspace();
  const { setOpen: setDecopilotOpen } = useDecopilotOpen();
  const { locator } = useSDK();
  const projectKey = typeof locator === "string" ? locator : undefined;
  const team = useCurrentTeam();

  // Find the Views view ID
  const viewsViewId = useMemo(() => {
    const views = (team?.views ?? []) as View[];
    const view = views.find((v) => v.title === "Views");
    return view?.id;
  }, [team?.views]);

  // Track visit to Views page for recents (only if unpinned)
  useTrackNativeViewVisit({
    viewId: viewsViewId || "views-fallback",
    viewTitle: "Views",
    viewIcon: "web",
    viewPath: `/${projectKey}/views`,
    projectKey,
  });

  // Automatically open Decopilot if openDecopilot query param is present
  useEffect(() => {
    const openDecopilot = searchParams.get("openDecopilot") === "true";
    if (openDecopilot) {
      setDecopilotOpen(true);
    }
  }, [searchParams, setDecopilotOpen]);

  // Determine active tab based on current route
  const activeTab = useMemo(() => {
    const pathname = location.pathname;
    if (pathname.includes("/views/legacy")) return "legacy";
    return "all";
  }, [location.pathname]);

  return (
    <ResourcesV2List
      integrationId="i:views-management"
      resourceName="view"
      headerSlot={headerSlot}
      tabs={[
        {
          id: "all",
          label: "All",
          onClick: () => navigateWorkspace("/views"),
        },
        {
          id: "legacy",
          label: "Legacy",
          onClick: () => navigateWorkspace("/views/legacy"),
        },
      ]}
      activeTab={activeTab}
      resourceRules={[NEW_VIEW_PROMPT]}
    />
  );
}

export default ViewsResourceList;

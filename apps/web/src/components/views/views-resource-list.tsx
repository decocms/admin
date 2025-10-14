import { type ReactNode, useEffect, useMemo } from "react";
import { useLocation, useSearchParams } from "react-router";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { useDecopilotOpen } from "../layout/decopilot-layout.tsx";
import { ResourcesV2List } from "../resources-v2/list.tsx";

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
    />
  );
}

export default ViewsResourceList;

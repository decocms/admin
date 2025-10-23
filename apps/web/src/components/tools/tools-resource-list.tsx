import { useMemo } from "react";
import { ResourcesV2List } from "../resources-v2/list.tsx";
import { useTrackNativeViewVisit, useSDK, type View } from "@deco/sdk";
import { useCurrentTeam } from "../sidebar/team-selector.tsx";

/**
 * Tools resource list component that renders the ResourcesV2List
 * with the specific integration ID for tools management
 */
export function ToolsResourceList() {
  const { locator } = useSDK();
  const projectKey = typeof locator === "string" ? locator : undefined;
  const team = useCurrentTeam();

  // Find the Tools view ID
  const toolsViewId = useMemo(() => {
    const views = (team?.views ?? []) as View[];
    const view = views.find((v) => v.title === "Tools");
    return view?.id;
  }, [team?.views]);

  // Track visit to Tools page for recents (only if unpinned)
  useTrackNativeViewVisit({
    viewId: toolsViewId || "tools-fallback",
    viewTitle: "Tools",
    viewIcon: "build",
    viewPath: `/${projectKey}/tools`,
    projectKey,
  });

  return (
    <ResourcesV2List integrationId="i:tools-management" resourceName="tool" />
  );
}

export default ToolsResourceList;

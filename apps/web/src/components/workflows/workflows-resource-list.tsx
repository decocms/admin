import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router";
import { useDecopilotOpen } from "../layout/decopilot-layout.tsx";
import { ResourcesV2List } from "../resources-v2/list.tsx";
import { useWorkflowTabs } from "./use-workflow-tabs.ts";
import { useTrackNativeViewVisit, useSDK, type View } from "@deco/sdk";
import { useCurrentTeam } from "../sidebar/team-selector.tsx";

/**
 * Workflows resource list component that renders the ResourcesV2List
 * with the specific integration ID for workflows management
 */
export function WorkflowsResourceList({
  resourceName = "workflow",
}: {
  resourceName?: "workflow" | "workflow_run";
} = {}) {
  const [searchParams] = useSearchParams();
  const { setOpen: setDecopilotOpen } = useDecopilotOpen();
  const { tabs, activeTab } = useWorkflowTabs();
  const { locator } = useSDK();
  const projectKey = typeof locator === "string" ? locator : undefined;
  const team = useCurrentTeam();

  // Find the Workflows view ID
  const workflowsViewId = useMemo(() => {
    const views = (team?.views ?? []) as View[];
    const view = views.find((v) => v.title === "Workflows");
    return view?.id;
  }, [team?.views]);

  // Track visit to Workflows page for recents (only if unpinned)
  useTrackNativeViewVisit({
    viewId: workflowsViewId || "workflows-fallback",
    viewTitle: "Workflows",
    viewIcon: "flowchart",
    viewPath: `/${projectKey}/workflows`,
    projectKey,
  });

  // Automatically open Decopilot if openDecopilot query param is present
  useEffect(() => {
    const openDecopilot = searchParams.get("openDecopilot") === "true";
    if (openDecopilot) {
      setDecopilotOpen(true);
    }
  }, [searchParams, setDecopilotOpen]);

  return (
    <ResourcesV2List
      integrationId="i:workflows-management"
      resourceName={resourceName}
      tabs={tabs}
      activeTab={activeTab}
    />
  );
}

export default WorkflowsResourceList;

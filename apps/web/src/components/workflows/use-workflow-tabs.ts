import { useMemo } from "react";
import { useLocation } from "react-router";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { useHideLegacyFeatures } from "../../hooks/use-hide-legacy-features.ts";
import type { TabItem } from "../resources-v2/resource-header.tsx";

export type WorkflowTab = "workflows" | "runs" | "runs-legacy" | "triggers";

export function useWorkflowTabs() {
  const location = useLocation();
  const navigateWorkspace = useNavigateWorkspace();
  const { showLegacyFeature } = useHideLegacyFeatures();

  // Determine active tab based on current route
  const activeTab = useMemo((): WorkflowTab => {
    const pathname = location.pathname;
    if (pathname.endsWith("/workflows/runs-legacy")) return "runs-legacy";
    if (pathname.endsWith("/workflows/runs")) return "runs";
    if (pathname.endsWith("/workflows/triggers")) return "triggers";
    if (pathname.endsWith("/workflows")) return "workflows";
    return "workflows";
  }, [location.pathname]);

  // Build tabs array - Workflow Runs is now always enabled
  const tabs = useMemo((): TabItem[] => {
    const allTabs: TabItem[] = [
      {
        id: "workflows",
        label: "Workflows",
        onClick: () => navigateWorkspace("/workflows"),
      },
      {
        id: "runs",
        label: "Runs",
        onClick: () => navigateWorkspace("/workflows/runs"),
      },
      ...(showLegacyFeature("showLegacyWorkflowRuns")
        ? [
            {
              id: "runs-legacy",
              label: "Runs (legacy)",
              onClick: () => navigateWorkspace("/workflows/runs-legacy"),
            },
          ]
        : []),
      {
        id: "triggers",
        label: "Triggers",
        onClick: () => navigateWorkspace("/workflows/triggers"),
      },
    ];
    return allTabs;
  }, [navigateWorkspace, showLegacyFeature]);

  return {
    tabs,
    activeTab,
  };
}

import { useMemo } from "react";
import { useLocation } from "react-router";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { useUserPreferences } from "../../hooks/use-user-preferences.ts";
import type { TabItem } from "../resources-v2/resource-header.tsx";

export type WorkflowTab = "workflows" | "runs" | "runs-legacy" | "triggers";

export function useWorkflowTabs() {
  const location = useLocation();
  const navigateWorkspace = useNavigateWorkspace();
  const { preferences } = useUserPreferences();

  // Determine active tab based on current route
  const activeTab = useMemo((): WorkflowTab => {
    const pathname = location.pathname;
    if (pathname.endsWith("/workflows/runs-legacy")) return "runs-legacy";
    if (pathname.endsWith("/workflows/runs")) return "runs";
    if (pathname.endsWith("/workflows/triggers")) return "triggers";
    if (pathname.endsWith("/workflows")) return "workflows";
    return "workflows";
  }, [location.pathname]);

  // Build tabs array conditionally based on user preferences
  const tabs = useMemo((): TabItem[] => {
    const allTabs: TabItem[] = [
      {
        id: "workflows",
        label: "Workflows",
        onClick: () => navigateWorkspace("/workflows"),
      },
      ...(preferences.enableWorkflowRuns
        ? [
            {
              id: "runs",
              label: "Runs",
              onClick: () => navigateWorkspace("/workflows/runs"),
            },
          ]
        : []),
      {
        id: "runs-legacy",
        label: "Runs (legacy)",
        onClick: () => navigateWorkspace("/workflows/runs-legacy"),
      },
      {
        id: "triggers",
        label: "Triggers",
        onClick: () => navigateWorkspace("/workflows/triggers"),
      },
    ];
    return allTabs;
  }, [navigateWorkspace, preferences.enableWorkflowRuns]);

  return {
    tabs,
    activeTab,
  };
}

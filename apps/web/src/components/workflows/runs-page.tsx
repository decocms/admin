import { lazy } from "react";
import { TabbedPageLayout } from "../common/tabbed-page-layout.tsx";

const WorkflowRuns = lazy(() => import("./list.tsx"));

export default function WorkflowsRunsPage() {
  return (
    <TabbedPageLayout
      component={WorkflowRuns}
      title="Workflows"
      tabs={[
        { id: "all", label: "All", path: "/workflows" },
        { id: "runs", label: "Runs", path: "/workflows/runs" },
        { id: "triggers", label: "Triggers", path: "/workflows/triggers" },
      ]}
      getActiveTab={(pathname) => {
        if (pathname.includes("/workflows/runs")) return "runs";
        if (pathname.includes("/workflows/triggers")) return "triggers";
        return "all";
      }}
    />
  );
}

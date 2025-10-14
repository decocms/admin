import { lazy } from "react";
import { TabbedPageLayout } from "../common/tabbed-page-layout.tsx";

const ListTriggers = lazy(() => import("../triggers/list.tsx"));

export default function WorkflowsTriggersPage() {
  return (
    <TabbedPageLayout
      component={ListTriggers}
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

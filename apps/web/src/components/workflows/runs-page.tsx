import WorkflowRuns from "./list.tsx";
import { WorkflowsTabs } from "./tabs-nav.tsx";

export default function WorkflowsRunsPage() {
  return <WorkflowRuns headerSlot={<WorkflowsTabs active="runs" />} />;
}

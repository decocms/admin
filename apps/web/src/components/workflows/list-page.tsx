import { WorkflowsResourceList } from "./workflows-resource-list.tsx";
import { WorkflowsTabs } from "./tabs-nav.tsx";

export default function WorkflowsListPage() {
  return (
    <WorkflowsResourceList headerSlot={<WorkflowsTabs active="workflows" />} />
  );
}

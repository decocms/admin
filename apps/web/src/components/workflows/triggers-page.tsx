import ListTriggers from "../triggers/list.tsx";
import { WorkflowsTabs } from "./tabs-nav.tsx";

export default function WorkflowsTriggersPage() {
  return <ListTriggers headerSlot={<WorkflowsTabs active="triggers" />} />;
}

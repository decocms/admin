import ActivitySettings from "../settings/activity.tsx";
import { AgentsTabs } from "./tabs-nav.tsx";

export default function AgentsThreadsPage() {
  return <ActivitySettings headerSlot={<AgentsTabs active="threads" />} />;
}

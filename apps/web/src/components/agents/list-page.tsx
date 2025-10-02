import AgentsList from "./list.tsx";
import { AgentsTabs } from "./tabs-nav.tsx";

export default function AgentsListPage() {
  return <AgentsList headerSlot={<AgentsTabs active="agents" />} />;
}

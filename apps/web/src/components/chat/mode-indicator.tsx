import { Badge } from "@deco/ui/components/badge.tsx";
import { useAgentStore } from "../../stores/mode-store.ts";
import { WELL_KNOWN_DECOPILOT_AGENTS } from "@deco/sdk";

const AGENT_COLORS: Record<keyof typeof WELL_KNOWN_DECOPILOT_AGENTS, string> = {
  design: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  code: "bg-green-500/10 text-green-600 border-green-500/20",
  explore: "bg-orange-500/10 text-orange-600 border-orange-500/20",
};

export function ModeIndicator() {
  const { agentId } = useAgentStore();
  const agent = WELL_KNOWN_DECOPILOT_AGENTS[agentId];

  return (
    <Badge
      variant="outline"
      className={`${AGENT_COLORS[agentId]} text-xs font-medium`}
    >
      {agent.name}
    </Badge>
  );
}

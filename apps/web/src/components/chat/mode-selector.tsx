import { type AgentId, WELL_KNOWN_DECOPILOT_AGENTS } from "@deco/sdk";
import { useAgentStore } from "../../stores/mode-store.ts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";

const AGENT_DESCRIPTIONS: Record<AgentId, string> = {
  design: "Create design documents",
  code: "Full write access",
  explore: "Test integrations via code",
};

const AGENT_COLORS: Record<AgentId, string> = {
  design: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  code: "bg-green-500/10 text-green-600 border-green-500/20",
  explore: "bg-orange-500/10 text-orange-600 border-orange-500/20",
};

export function ModeSelector() {
  const { agentId, setAgentId } = useAgentStore();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-accent transition-colors"
          title="Switch agent"
        >
          <Badge
            variant="outline"
            className={`${AGENT_COLORS[agentId]} text-xs font-medium border`}
          >
            {WELL_KNOWN_DECOPILOT_AGENTS[agentId].name.replace(" Agent", "")}
          </Badge>
          <Icon
            name="expand_more"
            size={14}
            className="text-muted-foreground"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {(Object.keys(WELL_KNOWN_DECOPILOT_AGENTS) as AgentId[]).map((id) => {
          const agent = WELL_KNOWN_DECOPILOT_AGENTS[id];
          return (
            <DropdownMenuItem
              key={id}
              onClick={() => setAgentId(id)}
              className={agentId === id ? "bg-accent" : ""}
            >
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {agent.name.replace(" Agent", "")}
                  </span>
                  {agentId === id && (
                    <Icon name="check" size={14} className="text-primary" />
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {AGENT_DESCRIPTIONS[id]}
                </span>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { type AgentId, WELL_KNOWN_DECOPILOT_AGENTS } from "@deco/sdk";
import { useAgentStore } from "../../stores/mode-store.ts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";

// Extract short description from agent goals
const AGENT_DESCRIPTIONS: Record<AgentId, string> = {
  design: "Design documents for implementation planning",
  code: "Creates and modifies tools, workflows and views",
  explore: "Explore the system and its capabilities",
};

export function ModeSelector() {
  const { agentId, setAgentId } = useAgentStore();
  const currentAgent =
    WELL_KNOWN_DECOPILOT_AGENTS[agentId] || WELL_KNOWN_DECOPILOT_AGENTS.explore;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-accent transition-colors"
          title="Switch agent"
        >
          <img
            src={currentAgent.avatar}
            alt={currentAgent.name}
            className="size-5 rounded-[3.571px] object-cover border border-border"
            onError={(e) => {
              const target = e.currentTarget;
              target.style.display = "none";
              const fallback = target.nextElementSibling as HTMLElement;
              if (fallback) {
                fallback.style.display = "flex";
              }
            }}
          />
          <div
            className="size-5 rounded-[3.571px] bg-muted border border-border items-center justify-center hidden"
            style={{ display: "none" }}
          >
            <Icon
              name="smart_toy"
              size={14}
              className="text-muted-foreground"
            />
          </div>
          <span className="text-sm font-medium">{currentAgent.name}</span>
          <Icon
            name="expand_more"
            size={16}
            className="text-muted-foreground"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {(Object.keys(WELL_KNOWN_DECOPILOT_AGENTS) as AgentId[]).map((id) => {
          const agent = WELL_KNOWN_DECOPILOT_AGENTS[id];
          const isSelected = agentId === id;
          return (
            <DropdownMenuItem
              key={id}
              onClick={() => setAgentId(id)}
              className={cn(
                "flex items-start gap-3 px-3 py-2.5 cursor-pointer",
                isSelected && "bg-accent",
              )}
            >
              <img
                src={agent.avatar}
                alt={agent.name}
                className="size-6 rounded-[3.571px] object-cover flex-shrink-0 border border-border"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.style.display = "none";
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) {
                    fallback.style.display = "flex";
                  }
                }}
              />
              <div
                className="size-6 rounded-[3.571px] bg-muted border border-border items-center justify-center hidden flex-shrink-0"
                style={{ display: "none" }}
              >
                <Icon
                  name="smart_toy"
                  size={14}
                  className="text-muted-foreground"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{agent.name}</span>
                  {isSelected && (
                    <Icon
                      name="check"
                      size={14}
                      className="text-foreground flex-shrink-0"
                    />
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {AGENT_DESCRIPTIONS[id]}
                </p>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

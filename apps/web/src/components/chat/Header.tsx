import { type Agent, WELL_KNOWN_AGENT_IDS } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { togglePanel } from "../agent/index.tsx";
import { AgentAvatar } from "../common/Avatar.tsx";

export function ChatHeader(
  { agent, panels = [] }: { agent?: Agent; panels?: string[] },
) {
  const handleSettings = () => {
    togglePanel({
      id: "settings",
      component: "settings",
      title: "Agent Settings",
      params: { agentId: agent?.id ?? "" },
    });
  };

  const handleThreads = () => {
    togglePanel({
      id: "threads",
      component: "threads",
      title: "Agent Threads",
      params: { agentId: agent?.id ?? "" },
    });
  };

  return (
    <>
      <div className="justify-self-start flex items-center gap-3 text-slate-700 py-1">
        {!agent
          ? (
            <>
              <Icon name="smart_toy" size={16} className="opacity-50" />
              <h1 className="text-sm font-medium tracking-tight opacity-50">
                This agent has been deleted
              </h1>
            </>
          )
          : agent.id === WELL_KNOWN_AGENT_IDS.teamAgent
          ? (
            <>
              <Icon name="forum" size={16} />
              <h1 className="text-sm font-medium tracking-tight">
                New chat
              </h1>
            </>
          )
          : (
            <>
              <div className="w-8 h-8 rounded-[10px] overflow-hidden flex items-center justify-center">
                <AgentAvatar
                  name={agent.name}
                  avatar={agent.avatar}
                  className="rounded-lg text-xs"
                />
              </div>
              <h1 className="text-sm font-medium tracking-tight">
                {agent.name}
              </h1>
            </>
          )}
      </div>
      {agent && (
        <div className="flex items-center gap-2 py-1">
          <Button
            onClick={handleThreads}
            variant="outline"
            size="icon"
            className={cn(
              "rounded-full h-8 w-8",
              panels.includes("threads")
                ? "border-none bg-slate-100"
                : "bg-background border-input",
            )}
            aria-label="Threads"
          >
            <Icon
              size={16}
              name="manage_search"
              className="text-slate-700"
            />
          </Button>
          <Button
            onClick={handleSettings}
            variant="outline"
            size="icon"
            className={cn(
              "rounded-full h-8 w-8",
              panels.includes("settings")
                ? "border-none bg-slate-100"
                : "bg-background border-input",
            )}
            aria-label="Start new chat"
          >
            <Icon
              size={16}
              name="tune"
              className="text-slate-700"
            />
          </Button>
        </div>
      )}
    </>
  );
}

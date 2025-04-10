import { type Agent, WELL_KNOWN_AGENT_IDS } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { togglePanel } from "../agent/index.tsx";
import { AgentAvatar } from "../common/Avatar.tsx";
import { Topbar } from "../topbar/index.tsx";

export function ChatHeader({ agent }: { agent?: Agent }) {
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
    <Topbar>
      <div className="justify-self-start flex items-center gap-3 text-slate-700">
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
        <div className="flex items-center gap-2">
          <Button
            onClick={handleThreads}
            variant="outline"
            size="icon"
            className="rounded-full hover:bg-muted"
            aria-label="Threads"
          >
            <Icon
              size={16}
              name="manage_search"
              className="text-muted-foreground"
            />
          </Button>
          <Button
            onClick={handleSettings}
            variant="outline"
            size="icon"
            className="rounded-full hover:bg-muted"
            aria-label="Start new chat"
          >
            <Icon
              size={16}
              name="tune"
              className="text-muted-foreground"
            />
          </Button>
        </div>
      )}
    </Topbar>
  );
}

import { useAgent, WELL_KNOWN_AGENT_IDS } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Suspense } from "react";
import { AgentAvatar } from "../common/Avatar.tsx";
import { useChatContext } from "./context.tsx";

export function ChatHeader() {
  return (
    <Suspense fallback={<div className="h-10" />}>
      <HeaderUI />
    </Suspense>
  );
}

function HeaderUI() {
  const { agentId } = useChatContext();
  const { data: agent } = useAgent(agentId);

  return (
    <div className="justify-self-start flex items-center gap-3 text-slate-700 py-1 h-10">
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
  );
}

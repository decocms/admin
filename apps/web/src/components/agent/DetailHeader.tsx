import { AgentNotFoundError, useAgent, WELL_KNOWN_AGENT_IDS } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Suspense } from "react";
import { ErrorBoundary } from "../../ErrorBoundary.tsx";
import { useChatContext } from "../chat/context.tsx";
import { AgentAvatar } from "../common/Avatar.tsx";
import { DockedToggleButton } from "../pageLayout.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { useFocusChat } from "../agents/hooks.ts";
import { useOpenSettingsIfQueryParam } from "./chat.tsx";

interface Props {
  agentId: string;
}

export function AgentHeader() {
  const { agentId } = useChatContext();

  if (agentId === WELL_KNOWN_AGENT_IDS.teamAgent) {
    return (
      <Container>
        <Icon name="forum" size={16} />
        <h1 className="text-sm font-medium tracking-tight">
          New chat
        </h1>
      </Container>
    );
  }

  return (
    <ErrorBoundary
      fallback={<AgentHeader.Fallback />}
      shouldCatch={(e) => e instanceof AgentNotFoundError}
    >
      <Suspense fallback={<AgentHeader.Skeleton />}>
        <AgentHeader.UI agentId={agentId} />
      </Suspense>
    </ErrorBoundary>
  );
}

AgentHeader.Fallback = () => {
  return (
    <Container>
      <Icon name="smart_toy" size={16} className="opacity-50" />
      <h1 className="text-sm font-medium tracking-tight opacity-50">
        This agent has been deleted
      </h1>
    </Container>
  );
};

AgentHeader.Skeleton = () => {
  return null;
};

AgentHeader.UI = ({ agentId }: Props) => {
  useOpenSettingsIfQueryParam();
  const { data: agent } = useAgent(agentId);
  const focusChat = useFocusChat();

  return (
    <>
      <Container>
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
      </Container>

      <div className="flex items-center gap-2 py-1">
        <Button
          variant="outline"
          title="New Chat"
          onClick={() => focusChat(agentId, crypto.randomUUID())}
        >
          <Icon name="chat_add_on" />
          New chat
        </Button>
        <DockedToggleButton
          id="settings"
          title="Settings"
          variant="outline"
          size="icon"
        >
          <Icon name="tune" />
        </DockedToggleButton>
      </div>
    </>
  );
};

const Container = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="justify-self-start flex items-center gap-3 text-slate-700 py-1">
      {children}
    </div>
  );
};

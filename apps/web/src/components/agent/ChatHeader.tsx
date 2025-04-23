import { AgentNotFoundError, useAgent, WELL_KNOWN_AGENT_IDS } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Suspense } from "react";
import { ErrorBoundary } from "../../ErrorBoundary.tsx";
import { useChatContext } from "../chat/context.tsx";
import { useEditAgent, useFocusChat } from "../agents/hooks.ts";
import { AgentAvatar } from "../common/Avatar.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import ActionsButton from "../chat/ActionsButton.tsx";

interface Props {
  agentId: string;
}

export function ChatHeader() {
  const { agentId } = useChatContext();

  if (agentId === WELL_KNOWN_AGENT_IDS.teamAgent) {
    return (
      <Container>
        <Icon name="forum" size={16} />
        <h1 className="text-sm font-medium tracking-tight">
          New chat
        </h1>
        <div className="ml-auto">
          <ActionsButton />
        </div>
      </Container>
    );
  }

  return (
    <ErrorBoundary
      fallback={<ChatHeader.Fallback />}
      shouldCatch={(e) => e instanceof AgentNotFoundError}
    >
      <Suspense fallback={<ChatHeader.Skeleton />}>
        <ChatHeader.UI agentId={agentId} />
      </Suspense>
    </ErrorBoundary>
  );
}

ChatHeader.Fallback = () => {
  return (
    <Container>
      <Icon name="smart_toy" size={16} className="opacity-50" />
      <h1 className="text-sm font-medium tracking-tight opacity-50">
        This agent has been deleted
      </h1>
    </Container>
  );
};

ChatHeader.Skeleton = () => {
  return <div className="h-10 w-full" />;
};

ChatHeader.UI = ({ agentId }: Props) => {
  const { data: agent } = useAgent(agentId);
  const focusChat = useFocusChat();
  const focusEditAgent = useEditAgent();

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
        <Button
          id="settings"
          title="Settings"
          variant="outline"
          size="icon"
          onClick={() => {
            focusEditAgent(agentId, crypto.randomUUID());
          }}
        >
          <Icon name="tune" />
        </Button>
      </div>
    </>
  );
};

const Container = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="justify-self-start flex items-center gap-3 text-slate-700 py-1 w-full">
      {children}
    </div>
  );
};

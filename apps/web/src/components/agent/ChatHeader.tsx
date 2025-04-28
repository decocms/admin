import { AgentNotFoundError, WELL_KNOWN_AGENT_IDS } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Suspense } from "react";
import { ErrorBoundary } from "../../ErrorBoundary.tsx";
import { useChatContext } from "../chat/context.tsx";
import { AgentHeader } from "./DetailHeader.tsx";

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

ChatHeader.UI = AgentHeader.UI;

const Container = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="justify-self-start flex items-center gap-3 text-slate-700 py-1 w-full">
      {children}
    </div>
  );
};

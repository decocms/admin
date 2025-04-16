import { AgentNotFoundError, useAgent, useMessages } from "@deco/sdk";
import { ErrorBoundary } from "../../ErrorBoundary.tsx";
import { ChatMessages as ChatUI } from "./ChatMessages.tsx";

function Chat(
  { agentId, threadId, panels }: {
    agentId: string;
    threadId: string;
    panels: string[];
  },
) {
  const { data: messages } = useMessages(agentId, threadId);
  const { data: agent } = useAgent(agentId);

  return (
    <ChatUI
      agent={agent}
      agentId={agentId}
      threadId={threadId}
      initialMessages={messages}
    />
  );
}

function AgentNotFound(
  { agentId, threadId, panels }: {
    agentId: string;
    threadId: string;
    panels: string[];
  },
) {
  const { data: messages } = useMessages(agentId, threadId);

  return (
    <ChatUI
      initialMessages={messages}
      threadId={threadId}
      agentId={agentId}
      panels={panels}
    />
  );
}

export default function AgentChat(
  { agentId, threadId, panels }: {
    agentId: string;
    threadId: string;
    panels: string[];
  },
) {
  return (
    <ErrorBoundary
      shouldCatch={(error) => error instanceof AgentNotFoundError}
      fallback={
        <AgentNotFound agentId={agentId} threadId={threadId} panels={panels} />
      }
    >
      <Chat agentId={agentId} threadId={threadId} panels={panels} />
    </ErrorBoundary>
  );
}

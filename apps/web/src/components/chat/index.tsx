import { AgentNotFoundError, useAgent, useMessages } from "@deco/sdk";
import { ErrorBoundary } from "../../ErrorBoundary.tsx";
import { Chat as ChatUI } from "./Chat.tsx";

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
      initialMessages={messages}
      threadId={threadId}
      agent={agent}
      panels={panels}
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
    <ChatUI initialMessages={messages} threadId={threadId} panels={panels} />
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

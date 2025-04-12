import { AgentNotFoundError, useAgent, useMessages } from "@deco/sdk";
import { ErrorBoundary } from "../../ErrorBoundary.tsx";
import { Chat as ChatUI } from "./Chat.tsx";

interface ChatProps {
  agentId: string;
  threadId: string;
  panels: string[];
  view?: "readonly" | "interactive";
  key?: string | number;
}

function Chat(
  { agentId, threadId, panels, view = "interactive", key }: ChatProps,
) {
  const { data: messages } = useMessages(agentId, threadId);
  const { data: agent } = useAgent(agentId);

  return (
    <ChatUI
      key={key}
      initialMessages={messages}
      threadId={threadId}
      agent={agent}
      panels={panels}
      view={view}
    />
  );
}

function AgentNotFound(
  { agentId, threadId, panels, view = "interactive", key }: ChatProps,
) {
  const { data: messages } = useMessages(agentId, threadId);

  return (
    <ChatUI
      key={key}
      initialMessages={messages}
      threadId={threadId}
      panels={panels}
      view={view}
    />
  );
}

export default function AgentChat(
  { agentId, threadId, panels, view, key }: ChatProps,
) {
  return (
    <ErrorBoundary
      shouldCatch={(error) => error instanceof AgentNotFoundError}
      fallback={
        <AgentNotFound
          key={key}
          agentId={agentId}
          threadId={threadId}
          panels={panels}
          view={view}
        />
      }
    >
      <Chat
        key={key}
        agentId={agentId}
        threadId={threadId}
        panels={panels}
        view={view}
      />
    </ErrorBoundary>
  );
}

import { useSDK, useThreadMessages, WELL_KNOWN_AGENTS } from "@deco/sdk";
import { useMemo, type ReactNode } from "react";
import {
  AgenticChatProvider,
  createDecopilotTransport,
} from "../chat/provider.tsx";
import { useThread } from "./thread-provider.tsx";
import { useDecopilotThread } from "./thread-context.tsx";

interface DecopilotChatProviderWrapperProps {
  children: ReactNode;
  forceBottomLayout: boolean;
}

export function DecopilotChatProviderWrapper({
  children,
  forceBottomLayout,
}: DecopilotChatProviderWrapperProps) {
  const { locator } = useSDK();
  const { getThread, activeThreadId } = useThread();
  const { threadState, clearThreadState } = useDecopilotThread();

  // Always use decopilot agent
  const agentId = WELL_KNOWN_AGENTS.decopilotAgent.id;
  const agent = WELL_KNOWN_AGENTS.decopilotAgent;

  // Get the current thread
  const currentThread = activeThreadId ? getThread(activeThreadId) : null;

  // Fetch thread messages
  const { data: threadData } = useThreadMessages(
    currentThread?.id || "",
    agentId,
    { shouldFetch: !!currentThread?.id },
  );

  const threadMessages = threadData?.messages ?? [];

  // Create decopilot transport
  const transport = useMemo(
    () =>
      currentThread
        ? createDecopilotTransport(currentThread.id, agentId, locator)
        : null,
    [currentThread, agentId, locator],
  );

  // If no thread exists, render children without the provider
  // Components that need chat context will need to handle this gracefully
  if (!currentThread || !transport) {
    return <>{children}</>;
  }

  return (
    <AgenticChatProvider
      key={currentThread.id}
      agentId={agentId}
      threadId={currentThread.id}
      agent={agent}
      transport={transport}
      initialMessages={threadMessages}
      initialInput={threadState.initialMessage || undefined}
      autoSend={threadState.autoSend}
      onAutoSendComplete={clearThreadState}
      forceBottomLayout={forceBottomLayout}
      uiOptions={{
        showModelSelector: true,
        showThreadMessages: true,
        showAgentVisibility: false,
        showEditAgent: false,
        showContextResources: true,
      }}
    >
      {children}
    </AgenticChatProvider>
  );
}

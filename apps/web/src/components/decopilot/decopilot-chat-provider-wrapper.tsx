import {
  DEFAULT_MODEL,
  isWellKnownDecopilotAgent,
  type Agent,
  useSDK,
  useThreadMessages,
  WELL_KNOWN_DECOPILOT_AGENTS,
} from "@deco/sdk";
import { useMemo, type ReactNode } from "react";
import { useAgentStore } from "../../stores/mode-store.ts";
import {
  AgenticChatProvider,
  createDecopilotTransport,
} from "../chat/provider.tsx";
import { useDecopilotThread } from "./thread-context.tsx";
import { useThread } from "./thread-provider.tsx";

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
  const { agentId: storeAgentId } = useAgentStore();

  // Use agentId from store, fallback to explore agent if not a well-known agent
  const agentId = isWellKnownDecopilotAgent(storeAgentId)
    ? storeAgentId
    : WELL_KNOWN_DECOPILOT_AGENTS.explore.id;

  // Construct Agent object from well-known agent config (no need to fetch from DB)
  const agent = useMemo<Agent | null>(() => {
    // Handle legacy "decopilotAgent" by mapping to "explore"
    const effectiveAgentId =
      (agentId as string) === "decopilotAgent" ? "explore" : agentId;
    const wellKnownAgent =
      WELL_KNOWN_DECOPILOT_AGENTS[
        effectiveAgentId as keyof typeof WELL_KNOWN_DECOPILOT_AGENTS
      ];
    if (!wellKnownAgent) return null;

    return {
      id: wellKnownAgent.id,
      name: wellKnownAgent.name,
      avatar: wellKnownAgent.avatar,
      description: "Ask, search or create anything.",
      model: DEFAULT_MODEL.id,
      visibility: "PUBLIC" as const,
      tools_set: {}, // Tools are filtered server-side based on agentId
      views: [],
      instructions: "",
      max_steps: 30, // Same as old decopilotAgent
      max_tokens: 64000, // Same as old decopilotAgent
      memory: { last_messages: 8 }, // Same as old decopilotAgent
    };
  }, [agentId]);

  // Get the current thread
  const currentThread = activeThreadId ? getThread(activeThreadId) : null;

  // Fetch thread messages - hook now provides stable initialMessages
  const { initialMessages } = useThreadMessages(
    currentThread?.id || "",
    agentId,
    { shouldFetch: !!currentThread?.id },
  );

  // Create decopilot transport
  const transport = useMemo(
    () =>
      currentThread
        ? createDecopilotTransport(currentThread.id, agentId, locator)
        : null,
    [currentThread, agentId, locator],
  );

  // If no thread exists or agent not available, render children without the provider
  // Components that need chat context will need to handle this gracefully
  if (!currentThread || !transport || !agent) {
    return <>{children}</>;
  }

  return (
    <AgenticChatProvider
      key={currentThread.id}
      agentId={agentId}
      threadId={currentThread.id}
      agent={agent}
      transport={transport}
      initialMessages={initialMessages}
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

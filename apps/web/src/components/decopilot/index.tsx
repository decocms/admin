import { WELL_KNOWN_AGENTS, useAgentRoot, useThreadMessages } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Suspense, useMemo } from "react";
import { useUserPreferences } from "../../hooks/use-user-preferences.ts";
import { MainChat, MainChatSkeleton } from "../agent/chat.tsx";
import { AgenticChatProvider, useAgenticChat } from "../chat/provider.tsx";
import { useDecopilotOpen } from "../layout/decopilot-layout.tsx";
import { useThreadManager } from "./thread-context-manager.tsx";
import { useDecopilotThread } from "./thread-context.tsx";

export const NO_DROP_TARGET = "no-drop-target";

const decopilotAgentId = WELL_KNOWN_AGENTS.decopilotAgent.id;

interface DecopilotChatWrapperProps {
  hasTabs: boolean;
  agent: typeof WELL_KNOWN_AGENTS.decopilotAgent;
  setOpen: (open: boolean) => void;
}

function DecopilotChatWrapper({
  hasTabs,
  agent,
  setOpen,
}: DecopilotChatWrapperProps) {
  const showHeader = hasTabs;

  return (
    <div className="flex flex-col h-full w-full">
      {showHeader && (
        <div className="flex h-10 items-center justify-between border-b border-border px-2 flex-none">
          <div className="flex items-center gap-2">
            <img
              src={agent.avatar}
              alt={agent.name}
              className="size-5 rounded"
            />
            <span className="text-sm font-medium">{agent.name}</span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex size-6 items-center justify-center rounded-full p-1 hover:bg-transparent transition-colors group cursor-pointer"
            title="Close chat"
          >
            <Icon
              name="close"
              size={16}
              className="text-muted-foreground group-hover:text-foreground transition-colors"
            />
          </button>
        </div>
      )}
      <div className="flex-1 min-h-0">
        <MainChat className="h-full" hasTabs={hasTabs} agent={agent} />
      </div>
    </div>
  );
}

/**
 * Custom hook to generate a thread title from the first message
 */
export function useThreadTitle(
  threadId: string | undefined,
  agentId: string,
  fallback: string = "New chat",
) {
  const { data: messages } = useThreadMessages(threadId ?? "", agentId, {
    shouldFetch: !!threadId,
  });

  return useMemo(() => {
    if (!messages?.messages || messages.messages.length === 0) {
      return fallback;
    }

    const firstMessage = messages.messages[0];
    const textPart = firstMessage?.parts?.find((p) => p.type === "text");

    if (textPart && "text" in textPart && textPart.text) {
      return textPart.text.trim();
    }

    return fallback;
  }, [messages?.messages, fallback]);
}

function DecopilotChatContent() {
  const { threadState, clearThreadState } = useDecopilotThread();
  const { getThread, getAllThreads, activeThreadId, tabs } = useThreadManager();
  const { setOpen } = useDecopilotOpen();

  // Always use decopilot agent
  const agentId = decopilotAgentId;
  const agent = WELL_KNOWN_AGENTS.decopilotAgent;

  // Just read the thread - don't create during render
  const currentThread = activeThreadId ? getThread(activeThreadId) : null;
  const allThreads = getAllThreads();
  const needsInitialThread = allThreads.length === 0;

  const agentRoot = useAgentRoot(agentId);
  const { preferences } = useUserPreferences();

  // Use unified hook that handles both backend and IndexedDB based on agentId
  const { data: threadData } = useThreadMessages(
    currentThread?.id || "",
    agentId,
    { shouldFetch: !!currentThread?.id },
  );

  const threadMessages = threadData?.messages ?? [];
  const hasTabs = tabs.length > 0;

  // If no thread yet, show empty state
  if (!currentThread) {
    return (
      <div className="flex h-full w-full flex-col">
        {/* Header with agent name */}
        <div className="flex h-10 items-center justify-between border-b border-border px-2">
          <div className="flex items-center gap-2">
            <img
              src={agent.avatar}
              alt={agent.name}
              className="size-5 rounded"
            />
            <span className="text-sm font-medium">{agent.name}</span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex size-6 items-center justify-center rounded-full p-1 hover:bg-transparent transition-colors group cursor-pointer"
            title="Close chat"
          >
            <Icon
              name="close"
              size={16}
              className="text-muted-foreground group-hover:text-foreground transition-colors"
            />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">
              {needsInitialThread
                ? "No threads yet. Use the sidebar to start a new chat."
                : "No active thread. Select a thread from the sidebar."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      {/* Single chat instance for current route */}
      <Suspense fallback={<MainChatSkeleton />}>
        <AgenticChatProvider
          key={currentThread.id}
          agentId={agentId}
          threadId={currentThread.id}
          agent={agent}
          agentRoot={agentRoot}
          model={preferences.defaultModel}
          useOpenRouter={preferences.useOpenRouter}
          sendReasoning={preferences.sendReasoning}
          useDecopilotAgent={true}
          initialMessages={threadMessages}
          initialInput={threadState.initialMessage || undefined}
          autoSend={threadState.autoSend}
          onAutoSendComplete={clearThreadState}
          uiOptions={{
            showModelSelector: true,
            showThreadMessages: true,
            showAgentVisibility: false,
            showEditAgent: false,
            showContextResources: true,
          }}
        >
          <DecopilotChatWrapper
            hasTabs={hasTabs}
            agent={agent}
            setOpen={setOpen}
          />
        </AgenticChatProvider>
      </Suspense>
    </div>
  );
}

export function DecopilotChat() {
  return (
    <Suspense fallback={<MainChatSkeleton />}>
      <DecopilotChatContent />
    </Suspense>
  );
}

DecopilotChat.displayName = "DefaultChat";

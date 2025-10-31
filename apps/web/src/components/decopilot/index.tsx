import { WELL_KNOWN_AGENTS, useAgentRoot, useThreadMessages } from "@deco/sdk";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { Suspense, useMemo } from "react";
import { useLocation } from "react-router";
import { useUserPreferences } from "../../hooks/use-user-preferences.ts";
import { useLocalStorage } from "../../hooks/use-local-storage.ts";
import { timeAgo } from "../../utils/time-ago.ts";
import { MainChat, MainChatSkeleton } from "../agent/chat.tsx";
import { AgenticChatProvider } from "../chat/provider.tsx";
import { useDecopilotOpen } from "../layout/decopilot-layout.tsx";
import { ModeSelector } from "./mode-selector.tsx";
import { useDecopilotThread } from "./thread-context.tsx";
import { useThreadManager } from "./thread-manager-context.tsx";

export const NO_DROP_TARGET = "no-drop-target";

const decochatAgentId = WELL_KNOWN_AGENTS.decochatAgent.id;
const decopilotAgentId = WELL_KNOWN_AGENTS.decopilotAgent.id;

/**
 * Custom hook to generate a thread title from the first message
 */
function useThreadTitle(
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

function ThreadItemSkeleton() {
  return (
    <DropdownMenuItem disabled className="flex items-center justify-between">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Skeleton className="h-3.5 w-3.5 rounded shrink-0" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-3 w-12 shrink-0 ml-2" />
    </DropdownMenuItem>
  );
}

function ThreadItem({
  threadId,
  agentId,
  isActive,
  onClick,
  onDelete,
  timestamp,
}: {
  threadId: string;
  agentId: string;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
  timestamp: number;
}) {
  const displayTitle = useThreadTitle(threadId, agentId, "New Thread");

  return (
    <DropdownMenuItem
      onClick={onClick}
      className="flex items-center justify-between group/item"
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Icon
          name={isActive ? "check" : "forum"}
          size={14}
          className={
            isActive
              ? "text-primary shrink-0"
              : "text-muted-foreground shrink-0"
          }
        />
        <span className="text-sm truncate">{displayTitle}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0 ml-2">
        <span className="text-xs text-muted-foreground">
          {timeAgo(timestamp, {
            format: "short",
            maxDays: 7,
            fallbackFormat: (date) => date.toLocaleDateString(),
          })}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="flex size-5 items-center justify-center rounded p-0.5 opacity-0 group-hover/item:opacity-100 hover:bg-destructive/10 transition-all cursor-pointer"
          title="Delete thread"
        >
          <Icon
            name="delete"
            size={14}
            className="text-muted-foreground hover:text-destructive transition-colors"
          />
        </button>
      </div>
    </DropdownMenuItem>
  );
}

function ThreadSelector({
  agentId,
  onThreadChange,
}: {
  agentId: string;
  onThreadChange?: () => void;
}) {
  const { pathname } = useLocation();
  const {
    getAllThreadsForRoute,
    getThreadForRoute,
    createNewThread,
    switchToThread,
    deleteThread,
  } = useThreadManager();

  const allThreads = getAllThreadsForRoute(pathname, agentId);
  const currentThread = getThreadForRoute(pathname, agentId);
  const currentThreadTitle = useThreadTitle(currentThread?.id, agentId);

  function handleNewThread() {
    createNewThread(pathname, agentId);
    onThreadChange?.();
  }

  function handleSwitchThread(threadId: string) {
    switchToThread(threadId);
    onThreadChange?.();
  }

  return (
    <div className="flex items-center gap-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-6 items-center gap-2 px-0 rounded-lg hover:bg-transparent transition-colors group cursor-pointer focus-visible:outline-none"
          >
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors max-w-[200px] truncate">
              {currentThreadTitle}
            </span>
            <Icon
              name="expand_more"
              size={16}
              className="text-muted-foreground group-hover:text-foreground transition-colors"
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {allThreads.map((thread) => (
            <Suspense key={thread.id} fallback={<ThreadItemSkeleton />}>
              <ThreadItem
                threadId={thread.id}
                agentId={agentId}
                isActive={thread.id === currentThread?.id}
                onClick={() => handleSwitchThread(thread.id)}
                onDelete={() => {
                  deleteThread(thread.id);
                  onThreadChange?.();
                }}
                timestamp={thread.updatedAt}
              />
            </Suspense>
          ))}
          {allThreads.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleNewThread}
                className="flex items-center gap-2"
              >
                <Icon name="add" size={14} />
                <span className="text-sm">New Thread</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function DecopilotChatContent() {
  const { threadState, clearThreadState } = useDecopilotThread();
  const { getThreadForRoute, createNewThread, getAllThreadsForRoute } =
    useThreadManager();
  const { pathname } = useLocation();
  const { setOpen } = useDecopilotOpen();
  const { value: storedMode, update: setStoredMode } = useLocalStorage<
    "decochat" | "decopilot"
  >({
    key: "decopilot:preferred-mode",
    defaultValue: "decopilot",
  });

  function handleModeChange(nextMode: "decochat" | "decopilot") {
    setStoredMode(nextMode);
  }

  // Select agent based on mode
  const agentId =
    storedMode === "decopilot" ? decopilotAgentId : decochatAgentId;

  // Just read the thread - don't create during render
  const currentThread = getThreadForRoute(pathname, agentId);
  const allThreads = getAllThreadsForRoute(pathname, agentId);
  const needsInitialThread = allThreads.length === 0;

  // Get agent from inline constants (both are well-known agents)
  const agent =
    storedMode === "decopilot"
      ? WELL_KNOWN_AGENTS.decopilotAgent
      : WELL_KNOWN_AGENTS.decochatAgent;
  const agentRoot = useAgentRoot(agentId);
  const { preferences } = useUserPreferences();

  // Use unified hook that handles both backend and IndexedDB based on agentId
  const { data: threadData } = useThreadMessages(
    currentThread?.id || "",
    agentId,
    { shouldFetch: !!currentThread?.id },
  );

  const threadMessages = threadData?.messages ?? [];

  // If no thread yet, show create thread button
  if (!currentThread) {
    return (
      <div className="flex h-full w-full flex-col">
        <div className="flex h-10 items-center gap-3 border-b border-border px-2">
          <ModeSelector mode={storedMode} onModeChange={handleModeChange} />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">
              {needsInitialThread ? "No threads yet" : "No active thread"}
            </p>
            <button
              type="button"
              onClick={() => createNewThread(pathname, agentId)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Icon name="add" size={16} />
              <span>Start new thread</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header with mode selector and thread controls */}
      <div className="flex h-10 items-center gap-3 border-b border-border px-2">
        <ModeSelector mode={storedMode} onModeChange={handleModeChange} />
        <span className="text-sm text-muted-foreground">/</span>
        <ThreadSelector agentId={agentId} onThreadChange={clearThreadState} />
        <div className="flex flex-1 items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => {
              createNewThread(pathname, agentId);
              clearThreadState();
            }}
            className="flex size-6 items-center justify-center rounded-full p-1 hover:bg-transparent transition-colors group cursor-pointer"
            title="New thread"
          >
            <Icon
              name="add"
              size={16}
              className="text-muted-foreground group-hover:text-foreground transition-colors"
            />
          </button>
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
      </div>

      {/* Single chat instance for current route */}
      <div className="flex-1 min-h-0">
        <Suspense fallback={<MainChatSkeleton />}>
          <AgenticChatProvider
            key={`${currentThread.id}-${storedMode}`}
            agentId={agentId}
            threadId={currentThread.id}
            agent={agent}
            agentRoot={agentRoot}
            model={preferences.defaultModel}
            useOpenRouter={preferences.useOpenRouter}
            sendReasoning={preferences.sendReasoning}
            useDecopilotAgent={storedMode === "decopilot"}
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
            <MainChat className="h-[calc(100vh-88px)]" />
          </AgenticChatProvider>
        </Suspense>
      </div>
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

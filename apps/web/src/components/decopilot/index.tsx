import {
  WELL_KNOWN_AGENTS,
  useAgentData,
  useAgentRoot,
  useThreadMessages,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
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
import { MainChat, MainChatSkeleton } from "../agent/chat.tsx";
import { AgenticChatProvider } from "../chat/provider.tsx";
import { useDecopilotThread } from "./thread-context.tsx";
import { useThreadManager } from "./thread-manager-context.tsx";

export const NO_DROP_TARGET = "no-drop-target";

const agentId = WELL_KNOWN_AGENTS.decopilotAgent.id;

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
  isActive,
  onClick,
  timestamp,
}: {
  threadId: string;
  isActive: boolean;
  onClick: () => void;
  timestamp: number;
}) {
  // Try to fetch thread, but don't throw if it doesn't exist yet
  const { data: messages } = useThreadMessages(threadId);

  function formatThreadDate(timestamp: number) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  // Generate a title from the first message if available
  const displayTitle = useMemo(() => {
    if (!messages?.messages || messages.messages.length === 0) {
      return "New Thread";
    }

    const firstMessage = messages.messages[0];
    const textPart = firstMessage?.parts?.find((p) => p.type === "text");

    if (textPart && "text" in textPart && textPart.text) {
      // Take first 50 characters of the first message as title
      const text = textPart.text.trim();
      return text.length > 50 ? `${text.substring(0, 50)}...` : text;
    }

    return "New Thread";
  }, [messages]);

  return (
    <DropdownMenuItem
      onClick={onClick}
      className="flex items-center justify-between"
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
      <span className="text-xs text-muted-foreground shrink-0 ml-2">
        {formatThreadDate(timestamp)}
      </span>
    </DropdownMenuItem>
  );
}

function ThreadSelector() {
  const { pathname } = useLocation();
  const {
    getAllThreadsForRoute,
    getThreadForRoute,
    createNewThread,
    switchToThread,
  } = useThreadManager();

  const allThreads = getAllThreadsForRoute(pathname);
  const currentThread = getThreadForRoute(pathname);

  function handleNewThread() {
    createNewThread(pathname);
  }

  function handleSwitchThread(threadId: string) {
    switchToThread(threadId);
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleNewThread}
        className="h-7 gap-1.5"
      >
        <Icon name="add" size={14} />
        <span className="text-xs">New Thread</span>
      </Button>

      {allThreads.length > 1 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5">
              <Icon name="forum" size={14} />
              <span className="text-xs">
                {allThreads.length}{" "}
                {allThreads.length === 1 ? "thread" : "threads"}
              </span>
              <Icon name="expand_more" size={12} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-80">
            {allThreads.map((thread) => (
              <Suspense key={thread.id} fallback={<ThreadItemSkeleton />}>
                <ThreadItem
                  threadId={thread.id}
                  isActive={thread.id === currentThread?.id}
                  onClick={() => handleSwitchThread(thread.id)}
                  timestamp={thread.createdAt}
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
      )}
    </div>
  );
}

export function DecopilotChat() {
  const { threadState, clearThreadState } = useDecopilotThread();
  const { getThreadForRoute } = useThreadManager();
  const { pathname } = useLocation();

  // Get the thread for the current route
  const currentThread = getThreadForRoute(pathname);

  // Fetch required data
  const { data: agent } = useAgentData(agentId);
  const agentRoot = useAgentRoot(agentId);
  const { preferences } = useUserPreferences();
  const { data } = useThreadMessages(currentThread?.id || "");
  const threadMessages = data?.messages ?? [];

  // If no thread yet or agent not loaded, show a loading state
  if (!currentThread || !agent) {
    return (
      <div className="flex h-full w-full flex-col">
        <div className="flex h-10 items-center justify-between gap-3 border-b border-border px-3">
          <div className="flex items-center gap-3">
            <img
              src={WELL_KNOWN_AGENTS.decopilotAgent.avatar}
              alt={WELL_KNOWN_AGENTS.decopilotAgent.name}
              className="size-5 rounded-md border border-border"
            />
            <span className="text-sm font-medium">decochat</span>
          </div>
        </div>
        <MainChatSkeleton />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header with agent info and thread controls */}
      <div className="flex h-10 items-center justify-between gap-3 border-b border-border px-3">
        <div className="flex items-center gap-3">
          <img
            src={WELL_KNOWN_AGENTS.decopilotAgent.avatar}
            alt={WELL_KNOWN_AGENTS.decopilotAgent.name}
            className="size-5 rounded-md border border-border"
          />
          <span className="text-sm font-medium">decochat</span>
        </div>
        <ThreadSelector />
      </div>

      {/* Single chat instance for current route */}
      <div className="flex-1 min-h-0">
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
DecopilotChat.displayName = "DefaultChat";

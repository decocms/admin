import {
  WELL_KNOWN_AGENTS,
  useAgentData,
  useAgentRoot,
  useThreadMessages,
} from "@deco/sdk";
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
import { timeAgo } from "../../utils/time-ago.ts";
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
        {timeAgo(timestamp, {
          format: "short",
          maxDays: 7,
          fallbackFormat: (date) => date.toLocaleDateString(),
        })}
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
    <div className="flex items-center gap-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-6 items-center gap-2 px-0 rounded-lg hover:bg-transparent transition-colors group cursor-pointer focus-visible:outline-none"
          >
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
              New chat
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
    </div>
  );
}

export function DecopilotChat() {
  const { threadState, clearThreadState } = useDecopilotThread();
  const { getThreadForRoute, createNewThread } = useThreadManager();
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
        <div className="flex h-10 items-center gap-2 border-b border-border px-2">
          <div className="flex items-center gap-2">
            <img
              src={WELL_KNOWN_AGENTS.decopilotAgent.avatar}
              alt={WELL_KNOWN_AGENTS.decopilotAgent.name}
              className="size-5 rounded-md border border-border"
            />
          </div>
        </div>
        <MainChatSkeleton />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header with agent info and thread controls */}
      <div className="flex h-10 items-center gap-2 border-b border-border px-2">
        <div className="flex items-center gap-2">
          <img
            src={WELL_KNOWN_AGENTS.decopilotAgent.avatar}
            alt={WELL_KNOWN_AGENTS.decopilotAgent.name}
            className="size-5 rounded-md border border-border"
          />
          <span className="text-sm">decochat</span>
          <span className="text-sm text-muted-foreground">/</span>
          <ThreadSelector />
        </div>
        <div className="flex flex-1 items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => createNewThread(pathname)}
            className="flex size-6 items-center justify-center rounded-full p-1 hover:bg-transparent transition-colors group cursor-pointer"
            title="New thread"
          >
            <Icon
              name="add"
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

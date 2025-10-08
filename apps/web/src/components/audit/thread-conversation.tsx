import { Suspense, useEffect, useMemo, useState } from "react";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import {
  useThread,
  useThreadMessages,
  useUpdateThreadTitle,
  type ThreadDetails,
} from "@deco/sdk";
import type { UIMessage } from "ai";
import { ThreadDetailPanel } from "./thread-detail-panel.tsx";
import { AgentProvider } from "../agent/provider.tsx";
import { MainChat } from "../agent/chat.tsx";
import { threadCache } from "../../utils/thread-cache.ts";

// Track which threads have already triggered title generation
const titlesInProgress = new Set<string>();

export function ThreadConversation({
  thread,
  onNavigate,
  canNavigatePrevious,
  canNavigateNext,
}: {
  thread: {
    id: string;
    title?: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
  } & Record<string, unknown>;
  onNavigate: (direction: "previous" | "next") => void;
  canNavigatePrevious: boolean;
  canNavigateNext: boolean;
}) {
  // Show header immediately with data from the thread list
  const threadForHeader = {
    id: thread.id,
    title: thread.title || "Untitled conversation",
    resourceId: thread.resourceId,
    metadata: (thread.metadata || {}) as Record<string, unknown>,
  };

  return (
    <ThreadDetailPanel
      thread={threadForHeader}
      onNavigate={onNavigate}
      canNavigatePrevious={canNavigatePrevious}
      canNavigateNext={canNavigateNext}
    >
      <ThreadMessagesWithCache threadId={thread.id} />
    </ThreadDetailPanel>
  );
}

// Wrapper that checks cache first
function ThreadMessagesWithCache({ threadId }: { threadId: string }) {
  const [cachedData, setCachedData] = useState(() => threadCache.get(threadId));

  // Reset cache check when threadId changes
  useEffect(() => {
    const cached = threadCache.get(threadId);
    setCachedData(cached);
  }, [threadId]);

  // If we have cached data, render it instantly (NO Suspense)
  if (cachedData) {
    return <CachedThreadMessages threadId={threadId} cachedData={cachedData} />;
  }

  // No cache, use normal loading WITH Suspense (scoped to messages area only)
  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
      <Suspense
        fallback={
          <div className="flex-1 space-y-4 p-4">
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-24 w-3/4 rounded-lg ml-auto" />
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-20 w-2/3 rounded-lg ml-auto" />
          </div>
        }
      >
        <ThreadMessages threadId={threadId} />
      </Suspense>
    </div>
  );
}

// Renders cached data instantly - NO HOOKS that could trigger Suspense
function CachedThreadMessages({
  threadId: _threadId,
  cachedData,
}: {
  threadId: string;
  cachedData: {
    threadDetail: ThreadDetails;
    messages: { messages: UIMessage[] };
  };
}) {
  if (!cachedData.threadDetail || !cachedData.messages) {
    return (
      <div className="flex-1 space-y-4 p-4">
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-24 w-3/4 rounded-lg ml-auto" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-20 w-2/3 rounded-lg ml-auto" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden h-full">
      <AgentProvider
        agentId={
          cachedData.threadDetail.metadata?.agentId ??
          cachedData.threadDetail.id
        }
        threadId={cachedData.threadDetail.id}
        uiOptions={{
          showThreadTools: false,
          showModelSelector: false,
          showThreadMessages: false,
          showAgentVisibility: false,
          showEditAgent: false,
          showContextResources: false,
        }}
        readOnly
        initialMessages={cachedData.messages.messages}
      >
        <MainChat
          showInput={false}
          initialScrollBehavior="top"
          className="flex-1 min-h-0 h-full"
          contentClassName="flex flex-col min-w-0"
        />
      </AgentProvider>
    </div>
  );
}

// Normal loading path (with caching after load)
function ThreadMessages({ threadId }: { threadId: string }) {
  const { data: threadDetail } = useThread(threadId);
  const title = useMemo(() => threadDetail?.title ?? "", [threadDetail?.title]);
  const { data: messages } = useThreadMessages(threadId);
  const updateThreadTitle = useUpdateThreadTitle();

  // Cache the data after it loads
  useEffect(() => {
    if (threadDetail && messages) {
      threadCache.set(threadId, threadDetail, messages);
    }
  }, [threadDetail, messages, threadId]);

  useEffect(() => {
    if (!title || !messages?.messages?.length) {
      return;
    }

    const isGeneratedTitle = !/^new thread/i.test(title.trim());

    // Check if this thread is already being processed or has a generated title
    if (isGeneratedTitle || titlesInProgress.has(threadId)) {
      return;
    }

    const summaryCandidate = extractSummaryCandidate(messages.messages);

    if (!summaryCandidate) {
      return;
    }

    // Mark this thread as in progress
    titlesInProgress.add(threadId);

    // Fire and forget - let it complete in background
    updateThreadTitle.mutate(
      {
        threadId,
        title: summaryCandidate,
        stream: true,
      },
      {
        onSettled: () => {
          // Clean up after mutation completes (success or error)
          titlesInProgress.delete(threadId);
        },
      },
    );
  }, [messages?.messages, threadId, title, updateThreadTitle]);

  if (!threadDetail || !messages) {
    return (
      <div className="flex-1 space-y-4 p-4">
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-24 w-3/4 rounded-lg ml-auto" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-20 w-2/3 rounded-lg ml-auto" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden h-full">
      <AgentProvider
        agentId={threadDetail.metadata?.agentId ?? threadDetail.id}
        threadId={threadDetail.id}
        uiOptions={{
          showThreadTools: false,
          showModelSelector: false,
          showThreadMessages: true,
          showAgentVisibility: false,
          showEditAgent: false,
          showContextResources: false,
        }}
        readOnly
      >
        <MainChat
          showInput={false}
          initialScrollBehavior="top"
          className="flex-1 min-h-0 h-full"
          contentClassName="flex flex-col min-w-0"
        />
      </AgentProvider>
    </div>
  );
}

function extractSummaryCandidate(
  messages: { role: string; content: unknown }[],
) {
  if (!messages.length) {
    return null;
  }

  const firstUserMessage = messages.find(
    (message) => message.role === "user" && typeof message.content === "string",
  );

  if (typeof firstUserMessage?.content !== "string") {
    return null;
  }

  const normalized = firstUserMessage.content.trim();

  if (!normalized) {
    return null;
  }

  if (normalized.length <= 80) {
    return normalized;
  }

  const truncated = normalized.slice(0, 80);
  const lastSpace = truncated.lastIndexOf(" ");

  return (lastSpace > 40 ? truncated.slice(0, lastSpace) : truncated).concat(
    "…",
  );
}

import { Icon } from "@deco/ui/components/icon.tsx";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@deco/ui/components/sidebar.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { useChat } from "../providers/chat-provider";
import { useThreads } from "../hooks/use-chat-store";
import { Suspense } from "react";
import { useDecoChatOpen } from "../hooks/use-deco-chat-open";
import type { Thread } from "../types/chat-threads";

/**
 * Individual thread item with title
 */
function ThreadListItem({
  thread,
  isActive,
}: {
  thread: Thread;
  isActive: boolean;
}) {
  const { setActiveThreadId, hideThread } = useChat();
  const [, setOpen] = useDecoChatOpen();

  // Generate a simple title from the thread's creation date or use the title if available
  const threadTitle =
    thread.title ||
    `Chat ${new Date(thread.created_at).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}`;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        className={`w-full pr-2 group/thread relative cursor-pointer ${
          isActive ? "bg-accent" : ""
        }`}
        onClick={() => {
          setActiveThreadId(thread.id);
          setOpen(true); // Ensure chat is open when switching threads
        }}
      >
        <div className="flex-1 min-w-0 flex flex-col items-start">
          <span className="truncate text-sm w-full">{threadTitle}</span>
        </div>
        {!isActive && (
          <Icon
            name="close"
            size={16}
            className="text-muted-foreground opacity-0 group-hover/thread:opacity-50 hover:opacity-100 cursor-pointer absolute right-1 top-1/2 -translate-y-1/2"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              hideThread(thread.id);
            }}
          />
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/**
 * Renders the list of recent chat threads
 */
function RecentThreadsList() {
  const { activeThreadId } = useChat();
  const threads = useThreads();
  const maxThreads = 5; // Show up to 5 recent threads

  // Get the most recent threads (limited, filtered and sorted)
  const recentThreads = threads
    .filter((t) => !t.hidden)
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )
    .slice(0, maxThreads);

  if (recentThreads.length === 0) {
    return (
      <SidebarMenuItem>
        <div className="px-4 py-2 text-xs text-muted-foreground text-center">
          No recent chats
        </div>
      </SidebarMenuItem>
    );
  }

  return (
    <>
      {recentThreads.map((thread) => (
        <Suspense key={thread.id} fallback={<ThreadItemSkeleton />}>
          <ThreadListItem
            thread={thread}
            isActive={thread.id === activeThreadId}
          />
        </Suspense>
      ))}
    </>
  );
}

/**
 * Skeleton for loading thread items
 */
function ThreadItemSkeleton() {
  return (
    <SidebarMenuItem>
      <div className="flex items-center gap-2 px-4 py-2">
        <Skeleton className="h-4 flex-1" />
      </div>
    </SidebarMenuItem>
  );
}

/**
 * Threads sidebar section matching apps/web structure
 */
export function ThreadsSidebarSection() {
  return (
    <>
      <SidebarMenuItem>
        <div className="px-2 py-0 text-xs font-medium text-muted-foreground flex items-center justify-between">
          <span>Recent Threads</span>
        </div>
      </SidebarMenuItem>
      <Suspense fallback={<ThreadItemSkeleton />}>
        <RecentThreadsList />
      </Suspense>
    </>
  );
}

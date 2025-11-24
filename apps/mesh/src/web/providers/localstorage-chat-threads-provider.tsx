import { ChatThreadsProvider } from "@deco/ui/providers/chat-threads-provider.tsx";
import { useProjectContext } from "@/web/providers/project-context-provider";
import { LOCALSTORAGE_KEYS } from "@/web/lib/localstorage-keys";
import { useLocalStorage } from "@/web/hooks/use-local-storage";
import type { ThreadManagerState } from "@deco/ui/types/chat-threads.ts";

export function LocalStorageChatThreadsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { locator } = useProjectContext();
  const [threadState, setThreadState] = useLocalStorage<ThreadManagerState>(
    LOCALSTORAGE_KEYS.threadManagerState(locator),
    (existing) => {
      if (!existing) {
        const defaultThreadId = crypto.randomUUID();
        return {
          threads: {
            [defaultThreadId]: {
              id: defaultThreadId,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              tabs: [],
              activeTabId: null,
              contextItems: [],
              messages: [],
            },
          },
          activeThreadId: defaultThreadId,
        };
      }
      return existing;
    },
  );

  return (
    <ChatThreadsProvider value={threadState} onChange={setThreadState}>
      {children}
    </ChatThreadsProvider>
  );
}

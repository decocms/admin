import { useThreads } from "@deco/sdk";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useUser } from "../../hooks/data/useUser.ts";
import { useFocusAgent } from "../agents/hooks.ts";

export interface Thread {
  id: string;
  resourceId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, string>;
}

interface GroupedThreads {
  today: Thread[];
  yesterday: Thread[];
  older: { [key: string]: Thread[] };
}

const formatDate = (date: Date): string => {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
};

export const groupThreadsByDate = (threads: Thread[]): GroupedThreads => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const sortedThreads = threads.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return sortedThreads.reduce((groups, thread) => {
    const threadDate = new Date(thread.createdAt);
    threadDate.setHours(0, 0, 0, 0);

    if (threadDate.getTime() === today.getTime()) {
      if (!groups.today) groups.today = [];
      groups.today.push(thread);
    } else if (threadDate.getTime() === yesterday.getTime()) {
      if (!groups.yesterday) groups.yesterday = [];
      groups.yesterday.push(thread);
    } else {
      const dateKey = formatDate(threadDate);
      if (!groups.older[dateKey]) groups.older[dateKey] = [];
      groups.older[dateKey].push(thread);
    }
    return groups;
  }, { today: [], yesterday: [], older: {} } as GroupedThreads);
};

function ThreadItem(
  { agentId, thread }: { agentId: string; thread: Thread },
) {
  const user = useUser();
  const focusAgent = useFocusAgent();
  return (
    <button
      type="button"
      onClick={() =>
        focusAgent(agentId, {
          threadId: thread.id.replace(`${user?.id ?? ""}-`, ""),
        })}
      className="w-full text-left p-3 hover:bg-slate-100 rounded-lg transition-colors"
    >
      <h2 className="text-sm">{thread.title}</h2>
    </button>
  );
}

function App({ agentId }: { agentId: string }) {
  const {
    data: threads,
    error: threadsError,
    isLoading: threadsLoading,
  } = useThreads(agentId);

  if (threadsLoading) {
    return (
      <div className="h-full bg-background flex flex-col items-center justify-center">
        <div className="relative">
          <Spinner />
        </div>
      </div>
    );
  }

  if (threadsError) {
    const error = threadsError;
    return (
      <div>
        Error loading agent: {typeof error === "object" && error !== null
          ? JSON.stringify(error)
          : String(error)}
      </div>
    );
  }

  const groupedThreads = groupThreadsByDate(threads);
  const olderDates = Object.keys(groupedThreads.older).sort((a, b) => {
    return new Date(b).getTime() - new Date(a).getTime();
  });

  const hasNoThreads = groupedThreads.today.length === 0 &&
    groupedThreads.yesterday.length === 0 &&
    olderDates.length === 0;

  return (
    <div className="p-6 text-slate-700 pb-20">
      <div className="max-w-2xl mx-auto space-y-6">
        {hasNoThreads
          ? (
            <div className="text-center py-12">
              <h2 className="text-lg font-medium text-slate-700 mb-2">
                No conversations yet
              </h2>
              <p className="text-sm text-slate-500">
                Start a new conversation to begin chatting with this agent.
              </p>
            </div>
          )
          : (
            <>
              {groupedThreads.today.length > 0 && (
                <div className="space-y-2">
                  <h2 className="text-sm font-medium text-slate-500">Today</h2>
                  {groupedThreads.today.map((thread) => (
                    <ThreadItem
                      key={thread.id}
                      agentId={agentId}
                      thread={thread}
                    />
                  ))}
                </div>
              )}

              {groupedThreads.yesterday.length > 0 && (
                <div className="space-y-2">
                  <h2 className="text-sm font-medium text-slate-500">
                    Yesterday
                  </h2>
                  {groupedThreads.yesterday.map((thread) => (
                    <ThreadItem
                      key={thread.id}
                      agentId={agentId}
                      thread={thread}
                    />
                  ))}
                </div>
              )}

              {olderDates.map((date) => (
                <div key={date} className="space-y-2">
                  <h2 className="text-sm font-medium text-slate-500">{date}</h2>
                  {groupedThreads.older[date].map((thread) => (
                    <ThreadItem
                      key={thread.id}
                      agentId={agentId}
                      thread={thread}
                    />
                  ))}
                </div>
              ))}
            </>
          )}
      </div>
    </div>
  );
}

export default App;

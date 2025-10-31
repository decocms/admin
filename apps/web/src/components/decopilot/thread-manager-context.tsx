import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { deleteThreadMessages, useSDK } from "@deco/sdk";

/**
 * Custom hook that combines useState with an effect callback
 * The effect callback is called whenever the state changes
 */
function useStateWithEffect<T>(
  initialValue: T | (() => T),
  effect: (value: T) => void,
): [T, (value: T | ((prevValue: T) => T)) => void] {
  const [state, setState] = useState(initialValue);

  const setStateWithEffect = useCallback(
    (value: T | ((prevValue: T) => T)) => {
      setState((prevState) => {
        const newState =
          typeof value === "function"
            ? (value as (prevValue: T) => T)(prevState)
            : value;
        effect(newState);
        return newState;
      });
    },
    [effect],
  );

  return [state, setStateWithEffect];
}

/**
 * Thread data - stores ID, route, and agent association
 */
export interface ThreadData {
  id: string;
  route: string;
  agentId: string;
  createdAt: number;
  updatedAt: number;
}

interface ThreadManagerContextValue {
  threads: Map<string, ThreadData>;
  activeThreadId: string | null;
  getThreadForRoute: (route: string, agentId: string) => ThreadData | null;
  getAllThreadsForRoute: (route: string, agentId: string) => ThreadData[];
  getActiveThread: () => ThreadData | null;
  createNewThread: (
    route: string,
    agentId: string,
    threadId?: string,
  ) => ThreadData;
  switchToThread: (threadId: string) => void;
  deleteThread: (threadId: string) => void;
}

const ThreadManagerContext = createContext<ThreadManagerContextValue | null>(
  null,
);

interface ThreadManagerProviderProps {
  children: ReactNode;
}

const STORAGE_KEY = "decopilot-thread-routes";

export function ThreadManagerProvider({
  children,
}: ThreadManagerProviderProps) {
  const { locator } = useSDK();

  // Load threads from localStorage with automatic persistence
  const [threads, setThreads] = useStateWithEffect<Map<string, ThreadData>>(
    () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          return new Map(Object.entries(parsed));
        }
      } catch (error) {
        console.error("[ThreadManager] Failed to load threads:", error);
      }
      return new Map();
    },
    (newThreads) => {
      // Persist to localStorage whenever threads change
      try {
        const obj = Object.fromEntries(newThreads);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
      } catch (error) {
        console.error("[ThreadManager] Failed to persist threads:", error);
      }
    },
  );

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  // Get the active thread for a route and agent (respects manual thread switching)
  const getThreadForRoute = useCallback(
    (route: string, agentId: string): ThreadData | null => {
      // First check if the active thread belongs to this route and agent
      if (activeThreadId) {
        const activeThread = threads.get(activeThreadId);
        if (
          activeThread &&
          activeThread.route === route &&
          activeThread.agentId === agentId
        ) {
          return activeThread;
        }
      }

      // Otherwise, return the most recent thread for this route and agent
      const routeThreads = Array.from(threads.values())
        .filter((t) => t.route === route && t.agentId === agentId)
        .sort((a, b) => b.updatedAt - a.updatedAt);
      return routeThreads.length > 0 ? routeThreads[0] : null;
    },
    [threads, activeThreadId],
  );

  // Get all threads for a route and agent (sorted by update time, newest first)
  const getAllThreadsForRoute = useCallback(
    (route: string, agentId: string): ThreadData[] => {
      return Array.from(threads.values())
        .filter((t) => t.route === route && t.agentId === agentId)
        .sort((a, b) => b.updatedAt - a.updatedAt);
    },
    [threads],
  );

  // Get active thread
  const getActiveThread = useCallback((): ThreadData | null => {
    if (!activeThreadId) return null;
    return threads.get(activeThreadId) || null;
  }, [activeThreadId, threads]);

  // Create a new thread for a route and agent (or reuse existing threadId)
  const createNewThread = useCallback(
    (route: string, agentId: string, threadId?: string): ThreadData => {
      const newId = threadId || crypto.randomUUID();
      const now = Date.now();
      const newThread: ThreadData = {
        id: newId,
        route,
        agentId,
        createdAt: now,
        updatedAt: now,
      };

      setThreads((prev) => new Map(prev).set(newId, newThread));
      setActiveThreadId(newId);

      return newThread;
    },
    [],
  );

  // Switch to an existing thread and update its updatedAt timestamp
  const switchToThread = useCallback((threadId: string) => {
    setActiveThreadId(threadId);
    setThreads((prev) => {
      const thread = prev.get(threadId);
      if (thread) {
        const updated = new Map(prev);
        updated.set(threadId, { ...thread, updatedAt: Date.now() });
        return updated;
      }
      return prev;
    });
  }, []);

  // Delete a thread
  const deleteThread = useCallback(
    (threadId: string) => {
      const threadToDelete = threads.get(threadId);
      if (!threadToDelete) return;

      setThreads((prev) => {
        const updated = new Map(prev);
        updated.delete(threadId);

        // If deleting the last thread for this route/agent, create a new one
        const remainingForRoute = Array.from(updated.values()).filter(
          (t) =>
            t.route === threadToDelete.route &&
            t.agentId === threadToDelete.agentId,
        );

        if (remainingForRoute.length === 0) {
          const newId = crypto.randomUUID();
          const now = Date.now();
          const newThread: ThreadData = {
            id: newId,
            route: threadToDelete.route,
            agentId: threadToDelete.agentId,
            createdAt: now,
            updatedAt: now,
          };
          updated.set(newId, newThread);
          // Set as active thread in the same state update
          setActiveThreadId(newId);
        } else if (activeThreadId === threadId) {
          // If we're deleting the active thread but others exist, clear active
          setActiveThreadId(null);
        }

        return updated;
      });

      // Also delete from IndexedDB
      deleteThreadMessages(threadId, locator).catch((error) => {
        console.error(
          "[ThreadManager] Failed to delete thread from IndexedDB:",
          error,
        );
      });
    },
    [activeThreadId, locator, threads],
  );

  const value: ThreadManagerContextValue = {
    threads,
    activeThreadId,
    getThreadForRoute,
    getAllThreadsForRoute,
    getActiveThread,
    createNewThread,
    switchToThread,
    deleteThread,
  };

  return (
    <ThreadManagerContext.Provider value={value}>
      {children}
    </ThreadManagerContext.Provider>
  );
}

export function useThreadManager(): ThreadManagerContextValue {
  const context = useContext(ThreadManagerContext);
  if (!context) {
    throw new Error(
      "useThreadManager must be used within ThreadManagerProvider",
    );
  }
  return context;
}

/**
 * @deprecated Use useSetThreadContext from thread-context-provider.tsx instead.
 * This function is kept for backward compatibility but does nothing.
 */
export function useThreadContextEffect(_context?: {
  rules?: string[];
  tools?: Record<string, string[]>;
}) {
  // This function is deprecated and does nothing
  // It's kept for backward compatibility during migration
}

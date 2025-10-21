import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router";

/**
 * Simplified thread data - only stores ID and route association
 */
export interface ThreadData {
  id: string;
  route: string;
  createdAt: number;
}

interface ThreadManagerContextValue {
  threads: Map<string, ThreadData>;
  activeThreadId: string | null;
  getThreadForRoute: (route: string) => ThreadData | null;
  getAllThreadsForRoute: (route: string) => ThreadData[];
  getActiveThread: () => ThreadData | null;
  createNewThread: (route: string) => ThreadData;
  switchToThread: (threadId: string) => void;
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
  const location = useLocation();

  // Load threads from localStorage
  const [threads, setThreads] = useState<Map<string, ThreadData>>(() => {
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
  });

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  // Persist threads to localStorage
  useEffect(() => {
    try {
      const obj = Object.fromEntries(threads);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch (error) {
      console.error("[ThreadManager] Failed to persist threads:", error);
    }
  }, [threads]);

  // Get the active thread for a route (respects manual thread switching)
  const getThreadForRoute = useCallback(
    (route: string): ThreadData | null => {
      // First check if the active thread belongs to this route
      if (activeThreadId) {
        const activeThread = threads.get(activeThreadId);
        if (activeThread && activeThread.route === route) {
          return activeThread;
        }
      }

      // Otherwise, return the most recent thread for this route
      const routeThreads = Array.from(threads.values())
        .filter((t) => t.route === route)
        .sort((a, b) => b.createdAt - a.createdAt);

      return routeThreads.length > 0 ? routeThreads[0] : null;
    },
    [threads, activeThreadId],
  );

  // Get all threads for a route (sorted by creation time, newest first)
  const getAllThreadsForRoute = useCallback(
    (route: string): ThreadData[] => {
      return Array.from(threads.values())
        .filter((t) => t.route === route)
        .sort((a, b) => b.createdAt - a.createdAt);
    },
    [threads],
  );

  // Get active thread
  const getActiveThread = useCallback((): ThreadData | null => {
    if (!activeThreadId) return null;
    return threads.get(activeThreadId) || null;
  }, [activeThreadId, threads]);

  // Create a new thread for a route
  const createNewThread = useCallback((route: string): ThreadData => {
    const newId = crypto.randomUUID();
    const newThread: ThreadData = {
      id: newId,
      route,
      createdAt: Date.now(),
    };

    setThreads((prev) => new Map(prev).set(newId, newThread));
    setActiveThreadId(newId);

    return newThread;
  }, []);

  // Switch to an existing thread
  const switchToThread = useCallback((threadId: string) => {
    setActiveThreadId(threadId);
  }, []);

  // Auto-create/activate thread for current route (only when route changes)
  useEffect(() => {
    const currentRoute = location.pathname;

    // Get all threads for this route
    const routeThreads = Array.from(threads.values())
      .filter((t) => t.route === currentRoute)
      .sort((a, b) => b.createdAt - a.createdAt);

    if (routeThreads.length > 0) {
      // If there's an active thread for this route, keep it
      // Otherwise, activate the most recent thread
      const activeThread = threads.get(activeThreadId || "");
      if (!activeThread || activeThread.route !== currentRoute) {
        setActiveThreadId(routeThreads[0].id);
      }
    } else {
      // Create new thread for this route
      const newId = crypto.randomUUID();
      const newThread: ThreadData = {
        id: newId,
        route: currentRoute,
        createdAt: Date.now(),
      };
      setThreads((prev) => new Map(prev).set(newId, newThread));
      setActiveThreadId(newId);
    }
    // Only depend on location.pathname to avoid re-running when activeThreadId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const value: ThreadManagerContextValue = {
    threads,
    activeThreadId,
    getThreadForRoute,
    getAllThreadsForRoute,
    getActiveThread,
    createNewThread,
    switchToThread,
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

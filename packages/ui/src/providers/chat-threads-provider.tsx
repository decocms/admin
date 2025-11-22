import type { UIMessage } from "ai";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type {
  CanvasTab,
  ContextItem,
  ThreadData,
  ThreadManagerState,
} from "../types/chat-threads.ts";

export interface ChatThreadsContextValue {
  // Thread management
  threads: Record<string, ThreadData>;
  activeThreadId: string;
  activeThread: ThreadData;
  getThread: (threadId: string) => ThreadData | null;
  getAllThreads: () => ThreadData[];
  createThread: (threadId?: string) => ThreadData;
  copyThreadTabs: (sourceThreadId?: string) => ThreadData;
  switchToThread: (threadId: string) => void;
  hideThread: (threadId: string) => void;

  // Tab management
  tabs: CanvasTab[];
  activeTabId: string | null;
  addTab: (tab: Omit<CanvasTab, "id">) => void;
  removeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  clearTabs: () => void;

  // Context items management
  contextItems: ContextItem[];
  addContextItem: (item: Omit<ContextItem, "id">) => string;
  removeContextItem: (id: string) => void;
  updateContextItem: (id: string, updates: Partial<ContextItem>) => void;
  setContextItems: (items: ContextItem[]) => void;

  // Messages management
  messages: UIMessage[];
  addMessage: (message: Omit<UIMessage, "id">) => string;
  updateMessage: (id: string, updates: Partial<UIMessage>) => void;
  clearMessages: () => void;
}

const ChatThreadsContext = createContext<ChatThreadsContextValue | null>(null);

export interface ChatThreadsProviderProps {
  children: ReactNode;
  storageKey: string; // e.g., "mesh:chat-threads:{orgSlug}"
  value: ThreadManagerState;
  onChange: (
    state:
      | ThreadManagerState
      | ((prev: ThreadManagerState) => ThreadManagerState),
  ) => void;
  /** Optional function to compute additional context items from tabs */
  computeContextFromTabs?: (
    tabs: CanvasTab[],
    activeTabId: string | null,
  ) => ContextItem[];
}

// Generate a stable default thread ID at module load
const DEFAULT_THREAD_ID = crypto.randomUUID();
const DEFAULT_THREAD: ThreadData = {
  id: DEFAULT_THREAD_ID,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  tabs: [],
  activeTabId: null,
  contextItems: [],
  messages: [],
};

/**
 * Filter context items to only include serializable types
 * Images and files are excluded as they can't be reliably serialized
 */
function getSerializableContextItems(items: ContextItem[]): ContextItem[] {
  return items.filter(
    (item) => item.type === "rule" || item.type === "toolset",
  );
}

export function ChatThreadsProvider({
  children,
  value: threadState,
  onChange: setThreadState,
  computeContextFromTabs,
}: ChatThreadsProviderProps) {
  // Wrap setThreadState to support functional updates
  const updateThreadState = useCallback(
    (
      updater:
        | ThreadManagerState
        | ((prev: ThreadManagerState) => ThreadManagerState),
    ) => {
      // Since setThreadState (from useLocalStorage) now supports functional updates,
      // we can pass the updater directly. This ensures we always use the latest state
      // from the query cache, preventing race conditions during rapid updates.
      setThreadState(updater);
    },
    [setThreadState],
  );

  const activeThreadId = threadState.activeThreadId;
  const activeThread = threadState.threads[activeThreadId] || DEFAULT_THREAD;
  const tabs = activeThread.tabs || [];
  const activeTabId = activeThread.activeTabId || null;

  // Separate manually added items (toolsets, etc.) from computed context
  const manualContextItems = activeThread.contextItems || [];

  // Compute additional context from tabs if function provided
  const computedContext = useMemo(() => {
    return computeContextFromTabs
      ? computeContextFromTabs(tabs, activeTabId)
      : [];
  }, [tabs, activeTabId, computeContextFromTabs]);

  // Merge computed context with manual items
  const contextItems: ContextItem[] = [
    ...computedContext,
    ...manualContextItems,
  ];

  // Messages
  const messages = activeThread.messages || [];

  // Context item management
  const addContextItem = useCallback(
    (item: Omit<ContextItem, "id">): string => {
      const id = crypto.randomUUID();
      const newItem = { ...item, id } as ContextItem;

      updateThreadState((prev) => {
        const thread = prev.threads[activeThreadId];
        if (!thread) {
          return prev;
        }

        const currentItems = thread.contextItems || [];
        const updatedItems = [...currentItems, newItem];
        const serializableItems = getSerializableContextItems(updatedItems);

        return {
          ...prev,
          threads: {
            ...prev.threads,
            [activeThreadId]: {
              ...thread,
              contextItems: serializableItems,
              updatedAt: Date.now(),
            },
          },
        };
      });

      return id;
    },
    [activeThreadId, updateThreadState],
  );

  const removeContextItem = useCallback(
    (id: string) => {
      updateThreadState((prev) => {
        const thread = prev.threads[activeThreadId];
        if (!thread) {
          return prev;
        }

        const updatedItems = (thread.contextItems || []).filter(
          (item) => item.id !== id,
        );

        return {
          ...prev,
          threads: {
            ...prev.threads,
            [activeThreadId]: {
              ...thread,
              contextItems: updatedItems,
              updatedAt: Date.now(),
            },
          },
        };
      });
    },
    [activeThreadId, updateThreadState],
  );

  const updateContextItem = useCallback(
    (id: string, updates: Partial<ContextItem>) => {
      updateThreadState((prev) => {
        const thread = prev.threads[activeThreadId];
        if (!thread) {
          return prev;
        }

        const updatedItems = (thread.contextItems || []).map((item) =>
          item.id === id ? { ...item, ...updates } : item,
        ) as ContextItem[];

        const updatedThread: ThreadData = {
          ...thread,
          contextItems: updatedItems,
          updatedAt: Date.now(),
        };

        return {
          ...prev,
          threads: {
            ...prev.threads,
            [activeThreadId]: updatedThread,
          },
        };
      });
    },
    [activeThreadId, updateThreadState],
  );

  const setContextItems = useCallback(
    (items: ContextItem[]) => {
      updateThreadState((prev) => {
        const thread = prev.threads[activeThreadId];
        if (!thread) {
          return prev;
        }

        const serializableItems = getSerializableContextItems(items);

        return {
          ...prev,
          threads: {
            ...prev.threads,
            [activeThreadId]: {
              ...thread,
              contextItems: serializableItems,
              updatedAt: Date.now(),
            },
          },
        };
      });
    },
    [activeThreadId, updateThreadState],
  );

  // Messages management
  const addMessage = useCallback(
    (message: Omit<UIMessage, "id">): string => {
      const newMessage: UIMessage = {
        ...message,
        id: crypto.randomUUID(),
      };

      updateThreadState((prev) => {
        const thread = prev.threads[activeThreadId];
        if (!thread) {
          return prev;
        }

        return {
          ...prev,
          threads: {
            ...prev.threads,
            [activeThreadId]: {
              ...thread,
              messages: [...(thread.messages || []), newMessage],
              updatedAt: Date.now(),
            },
          },
        };
      });

      return newMessage.id;
    },
    [activeThreadId, updateThreadState],
  );

  const updateMessage = useCallback(
    (id: string, updates: Partial<UIMessage>) => {
      updateThreadState((prev) => {
        const thread = prev.threads[activeThreadId];
        if (!thread) {
          return prev;
        }

        const updatedMessages = (thread.messages || []).map((msg) =>
          msg.id === id ? { ...msg, ...updates } : msg,
        );

        const updatedThread: ThreadData = {
          ...thread,
          messages: updatedMessages,
          updatedAt: Date.now(),
        };

        return {
          ...prev,
          threads: {
            ...prev.threads,
            [activeThreadId]: updatedThread,
          },
        };
      });
    },
    [activeThreadId, updateThreadState],
  );

  const clearMessages = useCallback(() => {
    updateThreadState((prev) => {
      const thread = prev.threads[activeThreadId];
      if (!thread) {
        return prev;
      }

      return {
        ...prev,
        threads: {
          ...prev.threads,
          [activeThreadId]: {
            ...thread,
            messages: [],
            updatedAt: Date.now(),
          },
        },
      };
    });
  }, [activeThreadId, updateThreadState]);

  // Thread management
  const getThread = useCallback(
    (threadId: string): ThreadData | null => {
      return threadState.threads[threadId] || null;
    },
    [threadState.threads],
  );

  const getAllThreads = useCallback((): ThreadData[] => {
    return Object.values(threadState.threads)
      .filter((t) => !t.hidden)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [threadState.threads]);

  const createThread = useCallback(
    (threadId?: string): ThreadData => {
      const newId = threadId || crypto.randomUUID();
      const now = Date.now();
      const newThread: ThreadData = {
        id: newId,
        createdAt: now,
        updatedAt: now,
        tabs: [],
        activeTabId: null,
        contextItems: [],
        messages: [],
      };

      updateThreadState((prev) => ({
        ...prev,
        threads: {
          ...prev.threads,
          [newId]: newThread,
        },
        activeThreadId: newId,
      }));

      return newThread;
    },
    [updateThreadState],
  );

  const copyThreadTabs = useCallback(
    (sourceThreadId?: string): ThreadData => {
      const sourceId = sourceThreadId || activeThreadId;
      const sourceThread = threadState.threads[sourceId];

      const newId = crypto.randomUUID();
      const now = Date.now();

      // Copy tabs and context items from source thread, but create new empty messages
      const newThread: ThreadData = {
        id: newId,
        createdAt: now,
        updatedAt: now,
        tabs: sourceThread ? [...sourceThread.tabs] : [],
        activeTabId: sourceThread?.activeTabId || null,
        contextItems: sourceThread
          ? [...(sourceThread.contextItems || [])]
          : [],
        messages: [],
      };

      updateThreadState((prev) => ({
        ...prev,
        threads: {
          ...prev.threads,
          [newId]: newThread,
        },
        activeThreadId: newId,
      }));

      return newThread;
    },
    [activeThreadId, threadState.threads, updateThreadState],
  );

  const switchToThread = useCallback(
    (threadId: string) => {
      updateThreadState((prev) => ({
        ...prev,
        activeThreadId: threadId,
      }));
    },
    [updateThreadState],
  );

  const hideThread = useCallback(
    (threadId: string) => {
      updateThreadState((prev) => {
        const thread = prev.threads[threadId];
        if (!thread) {
          return prev;
        }

        return {
          ...prev,
          threads: {
            ...prev.threads,
            [threadId]: {
              ...thread,
              hidden: true,
              updatedAt: Date.now(),
            },
          },
        };
      });
    },
    [updateThreadState],
  );

  // Tab management
  const addTab = useCallback(
    (tab: Omit<CanvasTab, "id">) => {
      const newTab: CanvasTab = {
        ...tab,
        id: crypto.randomUUID(),
      };

      updateThreadState((prev) => {
        const thread = prev.threads[activeThreadId];
        if (!thread) {
          return prev;
        }

        // Check if tab with same resourceUri already exists
        const existingTab = thread.tabs.find(
          (t) => t.resourceUri === newTab.resourceUri,
        );
        if (existingTab) {
          // Just switch to existing tab
          return {
            ...prev,
            threads: {
              ...prev.threads,
              [activeThreadId]: {
                ...thread,
                activeTabId: existingTab.id,
                updatedAt: Date.now(),
              },
            },
          };
        }

        return {
          ...prev,
          threads: {
            ...prev.threads,
            [activeThreadId]: {
              ...thread,
              tabs: [...thread.tabs, newTab],
              activeTabId: newTab.id,
              updatedAt: Date.now(),
            },
          },
        };
      });
    },
    [activeThreadId, updateThreadState],
  );

  const removeTab = useCallback(
    (tabId: string) => {
      updateThreadState((prev) => {
        const thread = prev.threads[activeThreadId];
        if (!thread) {
          return prev;
        }

        const updatedTabs = thread.tabs.filter((t) => t.id !== tabId);
        const wasActive = thread.activeTabId === tabId;
        const newActiveTabId = wasActive
          ? updatedTabs.length > 0
            ? updatedTabs[updatedTabs.length - 1]!.id
            : null
          : thread.activeTabId;

        return {
          ...prev,
          threads: {
            ...prev.threads,
            [activeThreadId]: {
              ...thread,
              tabs: updatedTabs,
              activeTabId: newActiveTabId,
              updatedAt: Date.now(),
            },
          },
        };
      });
    },
    [activeThreadId, updateThreadState],
  );

  const setActiveTab = useCallback(
    (tabId: string) => {
      updateThreadState((prev) => {
        const thread = prev.threads[activeThreadId];
        if (!thread) {
          return prev;
        }

        return {
          ...prev,
          threads: {
            ...prev.threads,
            [activeThreadId]: {
              ...thread,
              activeTabId: tabId,
              updatedAt: Date.now(),
            },
          },
        };
      });
    },
    [activeThreadId, updateThreadState],
  );

  const clearTabs = useCallback(() => {
    updateThreadState((prev) => {
      const thread = prev.threads[activeThreadId];
      if (!thread) {
        return prev;
      }

      return {
        ...prev,
        threads: {
          ...prev.threads,
          [activeThreadId]: {
            ...thread,
            tabs: [],
            activeTabId: null,
            updatedAt: Date.now(),
          },
        },
      };
    });
  }, [activeThreadId, updateThreadState]);

  const value: ChatThreadsContextValue = useMemo(
    () => ({
      threads: threadState.threads,
      activeThreadId,
      activeThread,
      getThread,
      getAllThreads,
      createThread,
      copyThreadTabs,
      switchToThread,
      hideThread,
      tabs,
      activeTabId,
      addTab,
      removeTab,
      setActiveTab,
      clearTabs,
      contextItems,
      addContextItem,
      removeContextItem,
      updateContextItem,
      setContextItems,
      messages,
      addMessage,
      updateMessage,
      clearMessages,
    }),
    [
      threadState.threads,
      activeThreadId,
      activeThread,
      getThread,
      getAllThreads,
      createThread,
      copyThreadTabs,
      switchToThread,
      hideThread,
      tabs,
      activeTabId,
      addTab,
      removeTab,
      setActiveTab,
      clearTabs,
      contextItems,
      addContextItem,
      removeContextItem,
      updateContextItem,
      setContextItems,
      messages,
      addMessage,
      updateMessage,
      clearMessages,
    ],
  );

  return (
    <ChatThreadsContext.Provider value={value}>
      {children}
    </ChatThreadsContext.Provider>
  );
}

export function useChatThreads(): ChatThreadsContextValue {
  const context = useContext(ChatThreadsContext);
  if (!context) {
    throw new Error("useChatThreads must be used within a ChatThreadsProvider");
  }
  return context;
}

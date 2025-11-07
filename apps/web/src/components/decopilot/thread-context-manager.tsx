import { useSDK } from "@deco/sdk";
import { createContext, useCallback, useContext, type ReactNode } from "react";
import { useLocalStorage } from "../../hooks/use-local-storage.ts";

// Generate a stable default thread ID at module load
const DEFAULT_THREAD_ID = crypto.randomUUID();
const DEFAULT_THREAD: ThreadData = {
  id: DEFAULT_THREAD_ID,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  tabs: [],
  activeTabId: null,
};

/**
 * Canvas tab - represents a tab in the canvas area
 */
export interface CanvasTab {
  id: string;
  type: "list" | "detail";
  resourceUri: string; // Required: uniquely identifies the tab
  title: string;
  icon?: string;
}

/**
 * Thread data - stores ID, timestamps, visibility, and tabs
 */
export interface ThreadData {
  id: string;
  createdAt: number;
  updatedAt: number;
  hidden?: boolean;
  tabs: CanvasTab[];
  activeTabId: string | null;
}

interface ThreadManagerContextValue {
  threads: Record<string, ThreadData>;
  activeThreadId: string | null;
  getThread: (threadId: string) => ThreadData | null;
  getAllThreads: () => ThreadData[];
  createThread: (threadId?: string) => ThreadData;
  switchToThread: (threadId: string) => void;
  hideThread: (threadId: string) => void;
  // Tab management
  createTab: (tab: Omit<CanvasTab, "id">) => CanvasTab | null;
  tabs: CanvasTab[];
  activeTabId: string | null;
  addTab: (tab: Omit<CanvasTab, "id">) => void;
  removeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  clearTabs: () => void;
}

const ThreadManagerContext = createContext<ThreadManagerContextValue | null>(
  null,
);

interface ThreadManagerProviderProps {
  children: ReactNode;
}

interface ThreadManagerState {
  threads: Record<string, ThreadData>;
  activeThreadId: string;
}

export function ThreadManagerProvider({
  children,
}: ThreadManagerProviderProps) {
  const { locator } = useSDK();

  // Single localStorage key for all thread state
  const STORAGE_KEY = `decopilot-threads:${locator}`;

  // Load all thread state from localStorage
  const [state, setState] = useLocalStorage<ThreadManagerState>(
    STORAGE_KEY,
    (existing) => {
      if (!existing) {
        return {
          threads: { [DEFAULT_THREAD_ID]: DEFAULT_THREAD },
          activeThreadId: DEFAULT_THREAD_ID,
        };
      }

      // Migrate existing threads to include tabs if missing
      const migratedThreads: Record<string, ThreadData> = {};
      for (const [id, thread] of Object.entries(existing.threads || {})) {
        migratedThreads[id] = {
          ...thread,
          tabs: thread.tabs ?? [],
          activeTabId: thread.activeTabId ?? null,
        };
      }

      return {
        threads: migratedThreads,
        activeThreadId: existing.activeThreadId || DEFAULT_THREAD_ID,
      };
    },
  );

  const activeThreadId = state.activeThreadId;

  // Get current active thread data
  const activeThread = state.threads[activeThreadId] || DEFAULT_THREAD;

  // Get tabs and activeTabId from active thread
  const tabs = activeThread.tabs || [];
  const activeTabId = activeThread.activeTabId || null;

  // Simple function to update state
  const updateState = useCallback(
    (updater: (prev: ThreadManagerState) => ThreadManagerState) => {
      const newState = updater(state);
      setState(newState);
    },
    [state, setState],
  );

  // Update active thread ID
  const setActiveThreadId = useCallback(
    (threadId: string) => {
      updateState((prev) => ({
        ...prev,
        activeThreadId: threadId,
      }));
    },
    [updateState],
  );

  // Simple function to update active tab - just updates thread state
  const setActiveTabId = useCallback(
    (tabId: string | null) => {
      const thread = state.threads[activeThreadId];
      if (!thread || thread.activeTabId === tabId) {
        return;
      }

      updateState((prev) => ({
        ...prev,
        threads: {
          ...prev.threads,
          [activeThreadId]: {
            ...thread,
            activeTabId: tabId,
            updatedAt: Date.now(),
          },
        },
      }));
    },
    [activeThreadId, state.threads, updateState],
  );

  // Get a specific thread by ID
  const getThread = useCallback(
    (threadId: string): ThreadData | null => {
      return state.threads[threadId] || null;
    },
    [state.threads],
  );

  // Get all visible threads (sorted by creation time, newest first)
  const getAllThreads = useCallback((): ThreadData[] => {
    return Object.values(state.threads)
      .filter((t) => !t.hidden)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [state.threads]);

  // Create a new thread (or reuse existing threadId)
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
      };

      updateState((prev) => ({
        ...prev,
        threads: {
          ...prev.threads,
          [newId]: newThread,
        },
        activeThreadId: newId,
      }));

      return newThread;
    },
    [updateState],
  );

  // Switch to an existing thread
  const switchToThread = useCallback(
    (threadId: string) => {
      setActiveThreadId(threadId);
    },
    [setActiveThreadId],
  );

  // Hide a thread (soft delete)
  const hideThread = useCallback(
    (threadId: string) => {
      const threadToHide = state.threads[threadId];
      if (!threadToHide) return;

      // Mark thread as hidden
      updateState((prev) => ({
        ...prev,
        threads: {
          ...prev.threads,
          [threadId]: { ...threadToHide, hidden: true },
        },
      }));

      // If we're hiding the active thread, switch to another visible one or create new
      if (activeThreadId === threadId) {
        let mostRecent: ThreadData | undefined;
        Object.values(state.threads).forEach((thread) => {
          if (thread.id !== threadId && !thread.hidden) {
            if (!mostRecent || thread.createdAt > mostRecent.createdAt) {
              mostRecent = thread;
            }
          }
        });

        if (mostRecent) {
          setActiveThreadId(mostRecent.id);
        } else {
          createThread();
        }
      }
    },
    [
      activeThreadId,
      state.threads,
      updateState,
      setActiveThreadId,
      createThread,
    ],
  );

  // Tab management methods
  const createTab = useCallback(
    (tab: Omit<CanvasTab, "id">): CanvasTab | null => {
      const thread = state.threads[activeThreadId];
      if (!thread) return null;

      const newTab: CanvasTab = { ...tab, id: crypto.randomUUID() };

      updateState((prev) => {
        const prevThread = prev.threads[activeThreadId];
        if (!prevThread) {
          return prev;
        }

        const prevTabs = prevThread.tabs ?? [];

        return {
          ...prev,
          threads: {
            ...prev.threads,
            [activeThreadId]: {
              ...prevThread,
              tabs: [...prevTabs, newTab],
              activeTabId: newTab.id,
              updatedAt: Date.now(),
            },
          },
        };
      });

      return newTab;
    },
    [activeThreadId, state.threads, updateState],
  );

  const addTab = useCallback(
    (tab: Omit<CanvasTab, "id">) => {
      const thread = state.threads[activeThreadId];
      if (!thread) return;

      const threadTabs = thread.tabs || [];

      // Check for duplicates (resourceUri uniquely identifies a tab)
      const existingTabIndex = threadTabs.findIndex(
        (t) => t.resourceUri === tab.resourceUri,
      );

      if (existingTabIndex !== -1) {
        const existingTab = threadTabs[existingTabIndex];

        // Update the existing tab's metadata (title, icon, type)
        const updatedTab: CanvasTab = {
          ...existingTab,
          title: tab.title,
          icon: tab.icon,
          type: tab.type,
        };

        const updatedTabs = [...threadTabs];
        updatedTabs[existingTabIndex] = updatedTab;

        updateState((prev) => ({
          ...prev,
          threads: {
            ...prev.threads,
            [activeThreadId]: {
              ...thread,
              tabs: updatedTabs,
              activeTabId: existingTab.id,
              updatedAt: Date.now(),
            },
          },
        }));
        return;
      }

      const newTab: CanvasTab = { ...tab, id: crypto.randomUUID() };
      const updatedTabs = [...threadTabs, newTab];

      updateState((prev) => ({
        ...prev,
        threads: {
          ...prev.threads,
          [activeThreadId]: {
            ...thread,
            tabs: updatedTabs,
            activeTabId: newTab.id,
            updatedAt: Date.now(),
          },
        },
      }));
    },
    [activeThreadId, state.threads, updateState],
  );

  const removeTab = useCallback(
    (tabId: string) => {
      const thread = state.threads[activeThreadId];
      if (!thread) return;

      const threadTabs = thread.tabs || [];
      const remainingTabs = threadTabs.filter((t) => t.id !== tabId);

      // If we're removing the active tab, switch to first remaining or null
      const wasActive = thread.activeTabId === tabId;
      const newActiveTabId = wasActive
        ? remainingTabs.length > 0
          ? remainingTabs[0].id
          : null
        : thread.activeTabId;

      updateState((prev) => ({
        ...prev,
        threads: {
          ...prev.threads,
          [activeThreadId]: {
            ...thread,
            tabs: remainingTabs,
            activeTabId: newActiveTabId,
            updatedAt: Date.now(),
          },
        },
      }));
    },
    [activeThreadId, state.threads, updateState],
  );

  const setActiveTab = useCallback(
    (tabId: string) => {
      setActiveTabId(tabId);
    },
    [setActiveTabId],
  );

  const clearTabs = useCallback(() => {
    const thread = state.threads[activeThreadId];
    if (!thread) return;

    updateState((prev) => ({
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
    }));
  }, [activeThreadId, state.threads, updateState]);

  const value: ThreadManagerContextValue = {
    threads: state.threads,
    activeThreadId,
    getThread,
    getAllThreads,
    createThread,
    switchToThread,
    hideThread,
    // Tab management
    createTab,
    tabs,
    activeTabId,
    addTab,
    removeTab,
    setActiveTab,
    clearTabs,
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
 * Optional version of useThreadManager that returns null if not within provider
 * Useful for components that may be rendered outside ThreadManagerProvider
 */
export function useThreadManagerOptional(): ThreadManagerContextValue | null {
  return useContext(ThreadManagerContext);
}

/**
 * Parse resourceUri to extract components
 * Supports formats:
 * - Native views: "native://{viewName}" (e.g., "native://documents")
 * - Resource list: "rsc://{integrationId}/{resourceName}"
 * - Resource detail: "rsc://{integrationId}/{resourceName}/{resourceId}"
 * - Custom views: "view://{integrationId}/{viewName}" (legacy integration views)
 * - Apps list: "apps://list"
 * - App detail: "app://{appKey}"
 * - Agents list: "agents://list"
 * - Agent detail: "agent://{agentId}/{threadId}"
 * - Thread detail: "thread://{threadId}" (standalone thread view)
 * - Trigger detail: "trigger://{triggerId}"
 * - Legacy prompt: "legacy-prompt://{promptId}"
 * - Legacy view: "legacy-view://{integrationId}/{viewName}"
 */
export function parseResourceUri(resourceUri: string): {
  protocol:
    | "native"
    | "rsc"
    | "view"
    | "app"
    | "apps"
    | "agents"
    | "agent"
    | "thread"
    | "trigger"
    | "legacy-prompt"
    | "legacy-view"
    | "legacy-workflow-run"
    | "unknown";
  integrationId?: string;
  resourceName?: string;
  resourceId?: string;
  nativeView?: string;
  viewName?: string;
  appKey?: string;
  agentId?: string;
  threadId?: string;
  triggerId?: string;
  promptId?: string;
  viewId?: string;
  workflowName?: string;
  runId?: string;
} {
  try {
    // Check for native views
    const nativeMatch = resourceUri.match(/^native:\/\/([^/]+)$/);
    if (nativeMatch) {
      return {
        protocol: "native",
        nativeView: nativeMatch[1],
      };
    }

    // Check for resource URIs
    const rscMatch = resourceUri.match(/^rsc:\/\/([^/]+)\/([^/]+)(?:\/(.+))?$/);
    if (rscMatch) {
      return {
        protocol: "rsc",
        integrationId: rscMatch[1],
        resourceName: rscMatch[2],
        resourceId: rscMatch[3], // undefined for list views
      };
    }

    // Check for custom view URIs (legacy integration views)
    const viewMatch = resourceUri.match(/^view:\/\/([^/]+)\/(.+)$/);
    if (viewMatch) {
      return {
        protocol: "view",
        integrationId: viewMatch[1],
        viewName: viewMatch[2],
      };
    }

    // Check for apps list
    if (resourceUri === "apps://list") {
      return {
        protocol: "apps",
      };
    }

    // Check for app detail URIs
    const appMatch = resourceUri.match(/^app:\/\/(.+)$/);
    if (appMatch) {
      return {
        protocol: "app",
        appKey: appMatch[1],
      };
    }

    // Check for agents list
    if (resourceUri === "agents://list") {
      return {
        protocol: "agents",
      };
    }

    // Check for agent detail URIs
    const agentMatch = resourceUri.match(/^agent:\/\/([^/]+)\/(.+)$/);
    if (agentMatch) {
      return {
        protocol: "agent",
        agentId: agentMatch[1],
        threadId: agentMatch[2],
      };
    }

    // Check for thread detail URIs
    const threadMatch = resourceUri.match(/^thread:\/\/(.+)$/);
    if (threadMatch) {
      return {
        protocol: "thread",
        threadId: threadMatch[1],
      };
    }

    // Check for trigger detail URIs
    const triggerMatch = resourceUri.match(/^trigger:\/\/(.+)$/);
    if (triggerMatch) {
      return {
        protocol: "trigger",
        triggerId: triggerMatch[1],
      };
    }

    // Check for legacy prompt URIs
    const legacyPromptMatch = resourceUri.match(/^legacy-prompt:\/\/(.+)$/);
    if (legacyPromptMatch) {
      return {
        protocol: "legacy-prompt",
        promptId: legacyPromptMatch[1],
      };
    }

    // Check for legacy view URIs
    const legacyViewMatch = resourceUri.match(/^legacy-view:\/\/(.+)$/);
    if (legacyViewMatch) {
      return {
        protocol: "legacy-view",
        viewId: legacyViewMatch[1],
      };
    }

    // Check for legacy workflow run URIs
    const legacyWorkflowRunMatch = resourceUri.match(
      /^legacy-workflow-run:\/\/([^/]+)\/(.+)$/,
    );
    if (legacyWorkflowRunMatch) {
      return {
        protocol: "legacy-workflow-run",
        workflowName: legacyWorkflowRunMatch[1],
        runId: legacyWorkflowRunMatch[2],
      };
    }

    return { protocol: "unknown" };
  } catch {
    return { protocol: "unknown" };
  }
}

/**
 * Get integrationId from a CanvasTab
 */
export function getTabIntegrationId(tab: CanvasTab): string | undefined {
  return parseResourceUri(tab.resourceUri).integrationId;
}

/**
 * Get resourceName from a CanvasTab
 */
export function getTabResourceName(tab: CanvasTab): string | undefined {
  return parseResourceUri(tab.resourceUri).resourceName;
}

/**
 * Build a resourceUri for resource list views
 * Format: "rsc://{integrationId}/{resourceName}"
 */
export function buildResourceUri(
  integrationId: string,
  resourceName: string,
): string {
  return `rsc://${integrationId}/${resourceName}`;
}

/**
 * Build a resourceUri for native views
 * Format: "native://{viewName}"
 */
export function buildNativeUri(viewName: string): string {
  return `native://${viewName}`;
}

/**
 * Build a resourceUri for custom integration views (legacy)
 * Format: "view://{integrationId}/{viewName}"
 */
export function buildViewUri(integrationId: string, viewName: string): string {
  return `view://${integrationId}/${viewName}`;
}

/**
 * Build a resourceUri for apps list
 * Format: "apps://list"
 */
export function buildAppsListUri(): string {
  return "apps://list";
}

/**
 * Build a resourceUri for app detail
 * Format: "app://{appKey}"
 */
export function buildAppUri(appKey: string): string {
  return `app://${appKey}`;
}

/**
 * Build a resourceUri for agents list
 * Format: "agents://list"
 */
export function buildAgentsListUri(): string {
  return "agents://list";
}

/**
 * Build a resourceUri for agent detail
 * Format: "agent://{agentId}/{threadId}"
 */
export function buildAgentUri(agentId: string, threadId: string): string {
  return `agent://${agentId}/${threadId}`;
}

/**
 * Build a resourceUri for thread detail (standalone thread view)
 * Format: "thread://{threadId}"
 */
export function buildThreadUri(threadId: string): string {
  return `thread://${threadId}`;
}

/**
 * Build a resourceUri for trigger detail
 * Format: "trigger://{triggerId}"
 */
export function buildTriggerUri(triggerId: string): string {
  return `trigger://${triggerId}`;
}

import { useSDK } from "@deco/sdk";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { COMPUTED_RULE_IDS } from "../../constants/context-rules.ts";
import { useLocalStorage } from "../../hooks/use-local-storage.ts";
import type { ContextItem, RuleContextItem } from "../chat/types.ts";

export interface ThreadContextValue {
  // Context items (single source of truth)
  contextItems: ContextItem[];

  // Context item management
  addContextItem: (item: Omit<ContextItem, "id">) => string; // Returns the generated ID
  removeContextItem: (id: string) => void;
  updateContextItem: (id: string, updates: Partial<ContextItem>) => void;
  setContextItems: (items: ContextItem[]) => void;
}

/**
 * Canvas tab - represents a tab in the canvas area
 */
export interface CanvasTab {
  id: string;
  type: "list" | "detail";
  resourceUri: string; // Required: uniquely identifies the tab
  title: string;
  icon?: string;
  rules?: string[]; // View-specific rules to include in AI context
  integrationId?: string; // Integration ID for views with rules
}

/**
 * Thread data - stores ID, timestamps, visibility, tabs, and context items
 */
export interface ThreadData {
  id: string;
  createdAt: number;
  updatedAt: number;
  hidden?: boolean;
  tabs: CanvasTab[];
  activeTabId: string | null;
  contextItems?: ContextItem[]; // Only serializable items (rules, toolsets)
}

export interface ThreadManagerValue {
  threads: Record<string, ThreadData>;
  activeThreadId: string | null;
  getThread: (threadId: string) => ThreadData | null;
  getAllThreads: () => ThreadData[];
  createThread: (threadId?: string) => ThreadData;
  copyThreadTabs: (sourceThreadId?: string) => ThreadData;
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

// Combined value
export interface ThreadProviderValue
  extends ThreadContextValue,
    ThreadManagerValue {}

const ThreadContext = createContext<ThreadProviderValue | null>(null);

interface ThreadProviderProps {
  children: ReactNode;
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

interface ThreadManagerState {
  threads: Record<string, ThreadData>;
  activeThreadId: string;
}

/**
 * Parse resourceUri to extract components
 */
export function parseResourceUri(resourceUri: string): {
  protocol: string;
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
        resourceId: rscMatch[3],
      };
    }

    // Check for custom view URIs
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
 * Mapping of native view names to their integration IDs and resource names
 */
const NATIVE_VIEW_MAPPING: Record<
  string,
  { integrationId: string; resourceName: string }
> = {
  documents: {
    integrationId: "i:documents-management",
    resourceName: "document",
  },
  tools: { integrationId: "i:tools-management", resourceName: "tool" },
  workflows: {
    integrationId: "i:workflows-management",
    resourceName: "workflow",
  },
  views: { integrationId: "i:views-management", resourceName: "view" },
  agents: {
    integrationId: "i:agent-management",
    resourceName: "agent",
  },
};

/**
 * Compute context rules from tabs
 * Creates a single consolidated rule describing all open resources
 */
function computeRulesFromTabs(
  tabs: CanvasTab[],
  activeTabId: string | null,
): RuleContextItem[] {
  if (tabs.length === 0) {
    return [];
  }

  const rules: RuleContextItem[] = [];
  const allIntegrationIds = new Set<string>();

  // Collect all resource URIs and integration IDs from all tabs
  const resourceUris: string[] = [];
  let activeTab: CanvasTab | undefined;

  // Collect rules from tabs with their integration IDs
  const activeTabRules: string[] = [];
  const otherTabRules: string[] = [];
  const otherViewIntegrationIds = new Set<string>();

  // Single pass through all tabs to collect all needed information
  for (const tab of tabs) {
    // Find the active tab during the loop
    if (tab.id === activeTabId) {
      activeTab = tab;
    }
    // Collect integration IDs directly from tabs (includes views and resources)
    if (tab.integrationId) {
      allIntegrationIds.add(tab.integrationId);
    }

    // Collect resource URIs for rsc:// tabs
    if (tab.resourceUri.startsWith("rsc://")) {
      resourceUris.push(tab.resourceUri);
    }

    // Collect integration IDs for native:// list tabs
    if (tab.type === "list" && tab.resourceUri.startsWith("native://")) {
      const nativeView = tab.resourceUri.replace("native://", "");
      const mapping = NATIVE_VIEW_MAPPING[nativeView];
      if (mapping) {
        allIntegrationIds.add(mapping.integrationId);
      }
    }

    // Collect rules from tabs with their integration IDs
    if (tab.rules && tab.rules.length > 0) {
      if (tab.id === activeTabId) {
        activeTabRules.push(...tab.rules);
      } else {
        otherTabRules.push(...tab.rules);
        if (tab.integrationId) {
          otherViewIntegrationIds.add(tab.integrationId);
        }
      }
    }
  }

  // RULE 1: Current viewing tab (resource ID + integration ID)
  const currentTabParts: string[] = [];

  if (activeTab) {
    // Check if this is a native list tab
    if (
      activeTab.type === "list" &&
      activeTab.resourceUri.startsWith("native://")
    ) {
      const nativeView = activeTab.resourceUri.replace("native://", "");
      const mapping = NATIVE_VIEW_MAPPING[nativeView];
      if (mapping) {
        const page = 1;
        currentTabParts.push(
          `Currently listing ${mapping.resourceName} from ${mapping.integrationId} (page ${page})`,
        );
      }
    } else if (activeTab.resourceUri.startsWith("rsc://")) {
      // Resource tab
      if (activeTab.integrationId) {
        currentTabParts.push(
          `Currently viewing: ${activeTab.resourceUri} (Integration: ${activeTab.integrationId})`,
        );
      } else {
        currentTabParts.push(`Currently viewing: ${activeTab.resourceUri}`);
      }
    } else if (activeTab.integrationId) {
      // For non-resource tabs (like legacy views), include basic info
      currentTabParts.push(
        `Currently viewing: ${activeTab.title} (Integration: ${activeTab.integrationId})`,
      );
    }
  }

  if (currentTabParts.length > 0) {
    rules.push({
      id: `${COMPUTED_RULE_IDS.OPEN_TABS_CONTEXT}:current`,
      type: "rule",
      text: currentTabParts.join(". "),
    });
  }

  // RULE 2: Other open tabs/resources
  const otherTabsParts: string[] = [];

  if (resourceUris.length > 0) {
    const otherResources = activeTab
      ? resourceUris.filter((uri) => uri !== activeTab.resourceUri)
      : resourceUris;

    if (otherResources.length > 0) {
      otherTabsParts.push(`Other open resources: ${otherResources.join(", ")}`);
    }
  }

  if (allIntegrationIds.size > 0) {
    otherTabsParts.push(
      `Open integrations: ${Array.from(allIntegrationIds).join(", ")}`,
    );
  }

  if (otherTabsParts.length > 0) {
    rules.push({
      id: `${COMPUTED_RULE_IDS.OPEN_TABS_CONTEXT}:other`,
      type: "rule",
      text: otherTabsParts.join(". "),
    });
  }

  // RULE 3: Additional context from views (rules from active and other view tabs)
  const viewContextParts: string[] = [];

  if (activeTabRules.length > 0) {
    const activeViewContext = activeTab?.integrationId
      ? `Active view context (${activeTab.integrationId}): ${activeTabRules.join(" ")}`
      : `Active view context: ${activeTabRules.join(" ")}`;
    viewContextParts.push(activeViewContext);
  }

  if (otherTabRules.length > 0) {
    const otherViewContext =
      otherViewIntegrationIds.size > 0
        ? `Additional view context (${Array.from(otherViewIntegrationIds).join(", ")}): ${otherTabRules.join(" ")}`
        : `Additional view context: ${otherTabRules.join(" ")}`;
    viewContextParts.push(otherViewContext);
  }

  if (viewContextParts.length > 0) {
    rules.push({
      id: `${COMPUTED_RULE_IDS.OPEN_TABS_CONTEXT}:views`,
      type: "rule",
      text: viewContextParts.join(". "),
    });
  }

  return rules;
}

export function ThreadProvider({ children }: ThreadProviderProps) {
  const { locator } = useSDK();

  // Thread management state
  const STORAGE_KEY = `decopilot-threads:${locator}`;
  const [threadState, setThreadState] = useLocalStorage<ThreadManagerState>(
    STORAGE_KEY,
    (existing) => {
      if (!existing) {
        return {
          threads: { [DEFAULT_THREAD_ID]: DEFAULT_THREAD },
          activeThreadId: DEFAULT_THREAD_ID,
        };
      }

      // Migrate existing threads
      const migratedThreads: Record<string, ThreadData> = {};
      for (const [id, thread] of Object.entries(existing.threads || {})) {
        migratedThreads[id] = {
          ...thread,
          tabs: thread.tabs ?? [],
          activeTabId: thread.activeTabId ?? null,
          contextItems: thread.contextItems ?? [],
        };
      }

      return {
        threads: migratedThreads,
        activeThreadId: existing.activeThreadId || DEFAULT_THREAD_ID,
      };
    },
  );

  // Wrap setThreadState to support functional updates
  const updateThreadState = useCallback(
    (
      updater:
        | ThreadManagerState
        | ((prev: ThreadManagerState) => ThreadManagerState),
    ) => {
      if (typeof updater === "function") {
        setThreadState(updater(threadState));
      } else {
        setThreadState(updater);
      }
    },
    [threadState, setThreadState],
  );

  const activeThreadId = threadState.activeThreadId;
  const activeThread = threadState.threads[activeThreadId] || DEFAULT_THREAD;
  const tabs = activeThread.tabs || [];
  const activeTabId = activeThread.activeTabId || null;

  // Separate manually added items (toolsets, etc.) from computed rules
  const manualContextItems = activeThread.contextItems || [];

  // Compute rules from tabs dynamically (memoized)
  const computedRules = useMemo(
    () => computeRulesFromTabs(tabs, activeTabId),
    [tabs, activeTabId],
  );

  // Merge computed rules with manual items
  const contextItems: ContextItem[] = [...computedRules, ...manualContextItems];

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
      // Prevent removal of computed rules (they're derived from tabs)
      if (
        id === COMPUTED_RULE_IDS.OPEN_TABS_CONTEXT ||
        id.startsWith(`${COMPUTED_RULE_IDS.OPEN_TABS_CONTEXT}:`)
      ) {
        return;
      }

      updateThreadState((prev) => {
        const thread = prev.threads[activeThreadId];
        if (!thread) return prev;

        const currentItems = thread.contextItems || [];
        const updatedItems = currentItems.filter((item) => item.id !== id);
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
    },
    [activeThreadId, updateThreadState],
  );

  const updateContextItem = useCallback(
    (id: string, updates: Partial<ContextItem>) => {
      // Prevent updates to computed rules (they're derived from tabs)
      if (id === COMPUTED_RULE_IDS.OPEN_TABS_CONTEXT) {
        return;
      }

      updateThreadState((prev) => {
        const thread = prev.threads[activeThreadId];
        if (!thread) return prev;

        const currentItems = thread.contextItems || [];
        const updatedItems = currentItems.map((item) =>
          item.id === id ? ({ ...item, ...updates } as ContextItem) : item,
        );
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
    },
    [activeThreadId, updateThreadState],
  );

  const setContextItems = useCallback(
    (items: ContextItem[]) => {
      updateThreadState((prev) => {
        const thread = prev.threads[activeThreadId];
        if (!thread) return prev;

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

  // ============= Thread Management =============

  const setActiveThreadId = useCallback(
    (threadId: string) => {
      updateThreadState((prev) => ({
        ...prev,
        activeThreadId: threadId,
      }));
    },
    [updateThreadState],
  );

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

      // Copy tabs and context items from source thread, but create a new empty chat
      const newThread: ThreadData = {
        id: newId,
        createdAt: now,
        updatedAt: now,
        tabs: sourceThread ? [...sourceThread.tabs] : [],
        activeTabId: sourceThread?.activeTabId || null,
        contextItems: sourceThread
          ? [...(sourceThread.contextItems || [])]
          : [],
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
      setActiveThreadId(threadId);
    },
    [setActiveThreadId],
  );

  const hideThread = useCallback(
    (threadId: string) => {
      updateThreadState((prev) => {
        const threadToHide = prev.threads[threadId];
        if (!threadToHide) return prev;

        const newState = {
          ...prev,
          threads: {
            ...prev.threads,
            [threadId]: { ...threadToHide, hidden: true },
          },
        };

        // If hiding the active thread, switch to another
        if (activeThreadId === threadId) {
          let mostRecent: ThreadData | undefined;
          Object.values(prev.threads).forEach((thread) => {
            if (thread.id !== threadId && !thread.hidden) {
              if (!mostRecent || thread.createdAt > mostRecent.createdAt) {
                mostRecent = thread;
              }
            }
          });

          if (mostRecent) {
            newState.activeThreadId = mostRecent.id;
          } else {
            // Create a new thread
            const newId = crypto.randomUUID();
            const now = Date.now();
            const newThread: ThreadData = {
              id: newId,
              createdAt: now,
              updatedAt: now,
              tabs: [],
              activeTabId: null,
              contextItems: [],
            };
            newState.threads[newId] = newThread;
            newState.activeThreadId = newId;
          }
        }

        return newState;
      });
    },
    [activeThreadId, updateThreadState],
  );

  // ============= Tab Management with Context Integration =============

  const createTab = useCallback(
    (tab: Omit<CanvasTab, "id">): CanvasTab | null => {
      const newTab: CanvasTab = { ...tab, id: crypto.randomUUID() };

      updateThreadState((prev) => {
        const thread = prev.threads[activeThreadId];
        if (!thread) return prev;

        const prevTabs = thread.tabs ?? [];

        return {
          ...prev,
          threads: {
            ...prev.threads,
            [activeThreadId]: {
              ...thread,
              tabs: [...prevTabs, newTab],
              activeTabId: newTab.id,
              updatedAt: Date.now(),
            },
          },
        };
      });

      return newTab;
    },
    [activeThreadId, updateThreadState],
  );

  const addTab = useCallback(
    (tab: Omit<CanvasTab, "id">) => {
      const newTabId = crypto.randomUUID();

      updateThreadState((prev: ThreadManagerState) => {
        const thread = prev.threads[activeThreadId];
        if (!thread) return prev;

        const threadTabs = thread.tabs || [];

        // Check for duplicates
        const existingTabIndex = threadTabs.findIndex(
          (t) => t.resourceUri === tab.resourceUri,
        );

        if (existingTabIndex !== -1) {
          const existingTab = threadTabs[existingTabIndex];
          const updatedTab: CanvasTab = {
            ...existingTab,
            title: tab.title,
            icon: tab.icon,
            type: tab.type,
          };

          const updatedTabs = [...threadTabs];
          updatedTabs[existingTabIndex] = updatedTab;

          return {
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
          };
        }

        // Create and add the new tab
        const newTab: CanvasTab = { ...tab, id: newTabId };
        const updatedTabs = [...threadTabs, newTab];

        return {
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
        };
      });
    },
    [activeThreadId, updateThreadState],
  );

  const removeTab = useCallback(
    (tabId: string) => {
      updateThreadState((prev: ThreadManagerState) => {
        const thread = prev.threads[activeThreadId];
        if (!thread) return prev;

        const threadTabs = thread.tabs || [];
        const remainingTabs = threadTabs.filter((t) => t.id !== tabId);

        const wasActive = thread.activeTabId === tabId;
        const newActiveTabId = wasActive
          ? remainingTabs.length > 0
            ? remainingTabs[0].id
            : null
          : thread.activeTabId;

        return {
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
        };
      });
    },
    [activeThreadId, updateThreadState],
  );

  const setActiveTab = useCallback(
    (tabId: string) => {
      updateThreadState((prev: ThreadManagerState) => {
        const thread = prev.threads[activeThreadId];
        if (!thread) return prev;

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
      if (!thread) return prev;

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

  const value: ThreadProviderValue = {
    // Context management
    contextItems,
    addContextItem,
    removeContextItem,
    updateContextItem,
    setContextItems,
    // Thread management
    threads: threadState.threads,
    activeThreadId,
    getThread,
    getAllThreads,
    createThread,
    copyThreadTabs,
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
    <ThreadContext.Provider value={value}>{children}</ThreadContext.Provider>
  );
}

export function useThread(): ThreadProviderValue {
  const context = useContext(ThreadContext);
  if (!context) {
    throw new Error("useThread must be used within ThreadProvider");
  }
  return context;
}

/**
 * Optional version that doesn't throw
 */
export function useThreadOptional(): ThreadProviderValue | null {
  const context = useContext(ThreadContext);
  return context;
}

// Helper functions for building URIs
export function getTabIntegrationId(tab: {
  resourceUri: string;
}): string | undefined {
  const parsed = parseResourceUri(tab.resourceUri);
  return parsed.integrationId;
}

export function getTabResourceName(tab: {
  resourceUri: string;
}): string | undefined {
  const parsed = parseResourceUri(tab.resourceUri);
  return parsed.resourceName;
}

export function buildResourceUri(
  integrationId: string,
  resourceName: string,
): string {
  return `rsc://${integrationId}/${resourceName}`;
}

export function buildNativeUri(viewName: string): string {
  return `native://${viewName}`;
}

export function buildViewUri(integrationId: string, viewName: string): string {
  return `view://${integrationId}/${viewName}`;
}

export function buildAppsListUri(): string {
  return "apps://list";
}

export function buildAppUri(appKey: string): string {
  return `app://${appKey}`;
}

export function buildAgentsListUri(): string {
  return "agents://list";
}

export function buildAgentUri(agentId: string, threadId: string): string {
  return `agent://${agentId}/${threadId}`;
}

export function buildThreadUri(threadId: string): string {
  return `thread://${threadId}`;
}

export function buildTriggerUri(triggerId: string): string {
  return `trigger://${triggerId}`;
}

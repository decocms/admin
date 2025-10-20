import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  type ReactNode,
} from "react";
import type { ContextItem } from "../chat/types.ts";

/**
 * Context for managing context items for threads.
 * This provider should be placed high in the React tree, above any chat providers.
 *
 * All context (rules, tools, files, resources) is stored as contextItems.
 * Rules and tools are derived from contextItems for backward compatibility.
 */

export interface ThreadContextValue {
  // Context items (single source of truth)
  contextItems: ContextItem[];

  // Context item management
  addContextItem: (item: Omit<ContextItem, "id">) => string; // Returns the generated ID
  removeContextItem: (id: string) => void;
  updateContextItem: (id: string, updates: Partial<ContextItem>) => void;
  setContextItems: (items: ContextItem[]) => void;
}

const ThreadContext = createContext<ThreadContextValue | null>(null);

interface ThreadContextProviderProps {
  children: ReactNode;
}

// State shape - simplified to only contextItems
interface ThreadContextState {
  contextItems: ContextItem[];
}

// Actions - simplified
type ThreadContextAction =
  | {
      type: "ADD_CONTEXT_ITEM";
      item: Omit<ContextItem, "id">;
      id: string;
    }
  | {
      type: "REMOVE_CONTEXT_ITEM";
      id: string;
    }
  | {
      type: "UPDATE_CONTEXT_ITEM";
      id: string;
      updates: Partial<ContextItem>;
    }
  | {
      type: "SET_CONTEXT_ITEMS";
      items: ContextItem[];
    };

// Reducer
function threadContextReducer(
  state: ThreadContextState,
  action: ThreadContextAction,
): ThreadContextState {
  switch (action.type) {
    case "ADD_CONTEXT_ITEM":
      return {
        contextItems: [
          ...state.contextItems,
          { ...action.item, id: action.id } as ContextItem,
        ],
      };
    case "REMOVE_CONTEXT_ITEM":
      return {
        contextItems: state.contextItems.filter(
          (item) => item.id !== action.id,
        ),
      };
    case "UPDATE_CONTEXT_ITEM":
      return {
        contextItems: state.contextItems.map((item) =>
          item.id === action.id
            ? ({ ...item, ...action.updates } as ContextItem)
            : item,
        ),
      };
    case "SET_CONTEXT_ITEMS":
      return { contextItems: action.items };
    default:
      return state;
  }
}

export function ThreadContextProvider({
  children,
}: ThreadContextProviderProps) {
  // Store context using reducer - single source of truth
  const [state, dispatch] = useReducer(threadContextReducer, {
    contextItems: [],
  });

  // Context item management
  const addContextItem = useCallback(
    (item: Omit<ContextItem, "id">): string => {
      const id = crypto.randomUUID();
      dispatch({ type: "ADD_CONTEXT_ITEM", item, id });
      return id;
    },
    [],
  );

  const removeContextItem = useCallback((id: string) => {
    dispatch({ type: "REMOVE_CONTEXT_ITEM", id });
  }, []);

  const updateContextItem = useCallback(
    (id: string, updates: Partial<ContextItem>) => {
      dispatch({ type: "UPDATE_CONTEXT_ITEM", id, updates });
    },
    [],
  );

  const setContextItems = useCallback((items: ContextItem[]) => {
    dispatch({ type: "SET_CONTEXT_ITEMS", items });
  }, []);

  const value: ThreadContextValue = {
    contextItems: state.contextItems,
    addContextItem,
    removeContextItem,
    updateContextItem,
    setContextItems,
  };

  return (
    <ThreadContext.Provider value={value}>{children}</ThreadContext.Provider>
  );
}

export function useThreadContext(): ThreadContextValue {
  const context = useContext(ThreadContext);
  if (!context) {
    throw new Error(
      "useThreadContext must be used within ThreadContextProvider",
    );
  }
  return context;
}

/**
 * Hook for pages to inject context items into the thread context.
 * Automatically updates when the route changes or when the context changes.
 *
 * IMPORTANT: Ensure that contextItems array is properly memoized in the
 * calling component to prevent infinite re-renders.
 */
export function useSetThreadContextEffect(contextItems?: ContextItem[]) {
  const { setContextItems } = useThreadContext();

  useEffect(() => {
    setContextItems(contextItems ?? []);
  }, [contextItems, setContextItems]);
}

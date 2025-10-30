import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router";

export interface ThreadState {
  threadId: string | null;
  initialMessage: string | null;
  autoSend: boolean;
}

/**
 * Decopilot Thread Context
 *
 * This context manages thread state for the Decopilot component.
 * It initializes from URL query string parameters (initialInput, autoSend) on mount,
 * then manages thread ID, initial message, and auto-send state.
 * URL parameters are left unchanged after initialization.
 *
 * Usage:
 * ```tsx
 * const { threadState, setThreadState, clearThreadState } = useDecopilotThread();
 *
 * // Set thread with initial message and auto-send
 * setThreadState({
 *   threadId: crypto.randomUUID(),
 *   initialMessage: "Please help me create a new item",
 *   autoSend: true
 * });
 *
 * // Clear thread state (resets to new thread with no initial message)
 * clearThreadState();
 * ```
 */
export interface DecopilotThreadContextValue {
  threadState: ThreadState;
  setThreadState: (state: ThreadState) => void;
  clearThreadState: () => void;
}

const DecopilotThreadContext = createContext<
  DecopilotThreadContextValue | undefined
>(undefined);

export interface DecopilotThreadProviderProps {
  children: ReactNode;
}

export function DecopilotThreadProvider({
  children,
}: DecopilotThreadProviderProps) {
  const [searchParams] = useSearchParams();

  // Initialize state from query string parameters
  const [threadState, setThreadState] = useState<ThreadState>(() => {
    const initialInput = searchParams.get("initialInput");
    const autoSend = searchParams.get("autoSend") === "true";

    return {
      threadId: null,
      initialMessage: initialInput,
      autoSend: autoSend && Boolean(initialInput),
    };
  });

  // Update thread state when query params change
  useEffect(() => {
    const initialInput = searchParams.get("initialInput");
    const autoSend = searchParams.get("autoSend") === "true";

    if (initialInput) {
      setThreadState({
        threadId: crypto.randomUUID(),
        initialMessage: initialInput,
        autoSend: autoSend && Boolean(initialInput),
      });
    }
  }, [searchParams]);

  const clearThreadState = () =>
    setThreadState((old) => ({
      ...old,
      autoSend: false,
      initialMessage: null,
    }));

  return (
    <DecopilotThreadContext.Provider
      value={{ threadState, setThreadState, clearThreadState }}
    >
      {children}
    </DecopilotThreadContext.Provider>
  );
}

export function useDecopilotThread(): DecopilotThreadContextValue {
  const context = useContext(DecopilotThreadContext);
  if (!context) {
    throw new Error(
      "useDecopilotThread must be used within a DecopilotThreadProvider",
    );
  }
  return context;
}

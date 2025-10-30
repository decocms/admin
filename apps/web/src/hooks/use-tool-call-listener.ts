import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";

export interface ToolCallEvent {
  toolName: string;
  input?: unknown;
}

/**
 * Hook to listen for tool calls and execute callbacks.
 * This replaces the onToolCall prop from the old DecopilotProvider.
 *
 * Usage:
 * ```tsx
 * useToolCallListener((toolCall) => {
 *   if (toolCall.toolName === "PROMPTS_UPDATE") {
 *     refetchPrompt();
 *   }
 * });
 * ```
 */
export function useToolCallListener(
  callback: (toolCall: ToolCallEvent) => void,
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    // Store in a global registry that chat provider can access
    const id = crypto.randomUUID();
    if (!globalThis.__toolCallListeners) {
      globalThis.__toolCallListeners = new Map();
    }
    globalThis.__toolCallListeners.set(id, callbackRef);

    return () => {
      globalThis.__toolCallListeners?.delete(id);
    };
  }, []);
}

/**
 * Internal hook for the chat provider to trigger all registered listeners
 */
export function useTriggerToolCallListeners() {
  return (toolCall: ToolCallEvent) => {
    if (globalThis.__toolCallListeners) {
      globalThis.__toolCallListeners.forEach((callbackRef) => {
        callbackRef.current?.(toolCall);
      });
    }
  };
}

type ToolCallCallback = (toolCall: ToolCallEvent) => void;

declare global {
  // eslint-disable-next-line no-var
  var __toolCallListeners:
    | Map<string, MutableRefObject<ToolCallCallback>>
    | undefined;
}

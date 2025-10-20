import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";

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
  callback: (toolCall: { toolName: string }) => void,
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
  return (toolCall: { toolName: string }) => {
    if (globalThis.__toolCallListeners) {
      globalThis.__toolCallListeners.forEach((callbackRef) => {
        callbackRef.current?.(toolCall);
      });
    }
  };
}

type ToolCallCallback = (toolCall: { toolName: string }) => void;

declare global {
  // eslint-disable-next-line no-var
  var __toolCallListeners:
    | Map<string, MutableRefObject<ToolCallCallback>>
    | undefined;
}

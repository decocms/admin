import { client as rawClient } from "./rpc";

/**
 * Helper to persist tool calls directly in localStorage
 */
const persistToolCall = (entry: {
  timestamp: number;
  tool: string;
  input: any;
  output: any;
}) => {
  const key = "toolCalls";
  const existing: typeof entry[] = JSON.parse(
    localStorage.getItem(key) ?? "[]",
  );
  const updated = [...existing, entry];

  // Keep only last 100 calls to avoid localStorage bloat
  const trimmed = updated.slice(-100);

  localStorage.setItem(key, JSON.stringify(trimmed));
  console.log("[tool-call]", entry); // Debug logging

  // Dispatch event for React components to refresh
  globalThis.dispatchEvent(new CustomEvent("__tool_calls_updated"));
};

/**
 * Proxied RPC client that logs all tool calls to localStorage
 */
export const client = new Proxy(rawClient, {
  get(target, prop) {
    const orig = (target as any)[prop];
    if (typeof orig !== "function") return orig;

    return async function (...args: any[]) {
      const input = args[0];

      try {
        const output = await orig.apply(this, args);
        persistToolCall({
          timestamp: Date.now(),
          tool: String(prop),
          input,
          output,
        });
        return output;
      } catch (error) {
        // Log errors too
        persistToolCall({
          timestamp: Date.now(),
          tool: String(prop),
          input,
          output: {
            error: error instanceof Error ? error.message : String(error),
          },
        });
        throw error;
      }
    };
  },
});

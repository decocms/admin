/**
 * Hook for fetching thread messages from either backend or IndexedDB
 * based on the agentId
 */

import { useSuspenseQuery } from "@tanstack/react-query";
import { WELL_KNOWN_AGENTS } from "../constants.ts";
import { getThreadMessages as getBackendThreadMessages } from "../crud/thread.ts";
import { getDecopilotThreadMessages } from "../storage/decopilot-storage.ts";
import { KEYS } from "./react-query-keys.ts";
import { useSDK } from "./store.tsx";

interface UseThreadMessagesOptions {
  shouldFetch?: boolean;
}

/**
 * Hook that fetches thread messages from:
 * - Backend API when agentId is not "decopilot" or when agentId is not provided
 * - IndexedDB when agentId is "decopilot"
 */
export function useThreadMessages(
  threadId: string,
  agentIdOrOptions?: string | UseThreadMessagesOptions,
  options?: UseThreadMessagesOptions,
) {
  const { locator } = useSDK();

  // Handle backward compatibility: if second param is options object, treat as old API
  let agentId: string | undefined;
  let finalOptions: UseThreadMessagesOptions;

  if (typeof agentIdOrOptions === "string") {
    agentId = agentIdOrOptions;
    finalOptions = options || {};
  } else {
    // Old API: threadId, { shouldFetch }
    agentId = undefined;
    finalOptions = agentIdOrOptions || {};
  }

  const { shouldFetch = true } = finalOptions;
  const isDecopilot = agentId === WELL_KNOWN_AGENTS.decopilotAgent.id;

  // Use different query keys for backend vs IndexedDB to avoid conflicts
  const queryKey = isDecopilot
    ? ["decopilot-messages", locator, threadId]
    : KEYS.THREAD_MESSAGES(locator, threadId);

  return useSuspenseQuery({
    queryKey,
    queryFn: async () => {
      if (!shouldFetch || !threadId) {
        return { messages: [] };
      }

      if (isDecopilot) {
        // Fetch from IndexedDB for decopilot
        const messages = await getDecopilotThreadMessages(threadId, locator);
        return { messages: messages || [] };
      } else {
        // Fetch from backend API for other agents
        return await getBackendThreadMessages(locator, threadId, {});
      }
    },
    staleTime: 0, // Always check for fresh data
    refetchOnMount: true,
    refetchOnWindowFocus: !isDecopilot, // Don't refetch IndexedDB on window focus
  });
}

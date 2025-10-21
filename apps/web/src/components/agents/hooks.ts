import { useUpdateThreadMessages } from "@deco/sdk";
import { useCallback } from "react";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";

interface AgentNavigationOptions {
  message?: string;
  history?: boolean;
  replace?: boolean;
}

const getChatPath = (agentId: string, threadId: string): string =>
  `/agent/${agentId}/${threadId}`;

export const useFocusChat = () => {
  const navigateWorkspace = useNavigateWorkspace();
  const updateMessages = useUpdateThreadMessages();

  const navigateToAgent = useCallback(
    (agentId: string, threadId: string, options?: AgentNavigationOptions) => {
      // If history is false, disable fetching history for faster navigation
      if (options?.history === false) {
        updateMessages(threadId);
      }

      const pathname = getChatPath(agentId, threadId);
      // Add query parameters if options are provided
      let url = pathname;
      const searchParams = new URLSearchParams();

      if (options?.message) {
        searchParams.append("message", options.message);
      }

      // Only append search params if we have any
      if (searchParams.toString()) {
        url = `${pathname}?${searchParams.toString()}`;
      }

      // Navigate to the agent page
      navigateWorkspace(url, options?.replace ? { replace: true } : undefined);
    },
    [navigateWorkspace, updateMessages],
  );

  return navigateToAgent;
};

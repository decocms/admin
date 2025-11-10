import { useUpdateThreadMessages } from "@deco/sdk";
import { useCallback } from "react";
import {
  useThreadOptional,
  buildAgentUri,
} from "../decopilot/thread-provider.tsx";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";

interface AgentNavigationOptions {
  message?: string;
  history?: boolean;
  replace?: boolean;
}

export const useFocusChat = () => {
  const threadManager = useThreadOptional();
  const addTab = threadManager?.addTab;
  const updateMessages = useUpdateThreadMessages();
  const navigateWorkspace = useNavigateWorkspace();

  const navigateToAgent = useCallback(
    (agentId: string, threadId: string, options?: AgentNavigationOptions) => {
      // If history is false, disable fetching history for faster navigation
      if (options?.history === false) {
        updateMessages(threadId);
      }

      // Open agent in a canvas tab if available, otherwise navigate
      if (addTab) {
        addTab({
          type: "detail",
          resourceUri: buildAgentUri(agentId, threadId),
          title: "Loading...", // Will be updated when agent loads
          icon: "robot_2",
        });
      } else {
        // Fallback to navigation if tabs aren't available
        navigateWorkspace(`/agent/${agentId}/${threadId}`);
      }
    },
    [addTab, updateMessages, navigateWorkspace],
  );

  return navigateToAgent;
};

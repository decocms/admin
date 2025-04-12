import { useCallback } from "react";
import { useNavigate } from "react-router";
import { useBasePath } from "../../hooks/useBasePath.ts";

// Helper to get agent URL
const getAgentPath = (agentId: string, threadId?: string): string =>
  `/agent/${agentId}/${threadId ?? ""}`;

interface AgentNavigationOptions {
  threadId?: string;
  message?: string;
}

export const useFocusAgent = () => {
  const navigate = useNavigate();
  const withBasePath = useBasePath();

  const navigateToAgent = useCallback(
    (agentId: string, options?: AgentNavigationOptions) => {
      const pathname = withBasePath(getAgentPath(agentId, options?.threadId));
      
      // Add message as a query parameter if provided
      let url = pathname;
      if (options?.message) {
        const searchParams = new URLSearchParams();
        searchParams.append('message', options.message);
        url = `${pathname}?${searchParams.toString()}`;
      }

      // Navigate to the agent page
      navigate(url);
    },
    [withBasePath, navigate],
  );

  return navigateToAgent;
};

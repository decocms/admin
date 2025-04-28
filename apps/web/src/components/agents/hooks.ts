import { useCallback } from "react";
import { useNavigate } from "react-router";
import { useBasePath } from "../../hooks/useBasePath.ts";

const getChatPath = (agentId: string, threadId: string): string =>
  `/chat/${agentId}/${threadId}`;

interface ChatNavigationOptions {
  message?: string;
  openSettings?: boolean;
}

export const useFocusChat = () => {
  const navigate = useNavigate();
  const withBasePath = useBasePath();

  const navigateToAgent = useCallback(
    (agentId: string, threadId: string, options?: ChatNavigationOptions) => {
      const pathname = withBasePath(getChatPath(agentId, threadId));
      // Add query parameters if options are provided
      let url = pathname;
      const searchParams = new URLSearchParams();

      if (options?.message) {
        searchParams.append("message", options.message);
      }

      if (options?.openSettings) {
        searchParams.append("openSettings", "true");
      }

      // Only append search params if we have any
      if (searchParams.toString()) {
        url = `${pathname}?${searchParams.toString()}`;
      }

      // Navigate to the agent page
      navigate(url);
    },
    [withBasePath, navigate],
  );

  return navigateToAgent;
};

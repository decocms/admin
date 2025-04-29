import { useUpdateThreadMessages } from "@deco/sdk";
import { useCallback } from "react";
import { useNavigate } from "react-router";
import { useBasePath } from "../../hooks/useBasePath.ts";

interface AgentNavigationOptions {
  message?: string;
  history?: boolean;
}

const getEditAgentPath = (agentId: string, threadId?: string): string =>
  `/agent/${agentId}/${threadId}`;
const getChatPath = (agentId: string, threadId: string): string =>
  `/chat/${agentId}/${threadId}`;

export const useEditAgent = () => {
  const navigate = useNavigate();
  const withBasePath = useBasePath();
  const updateMessages = useUpdateThreadMessages();
  return useCallback(
    (agentId: string, threadId?: string, options?: AgentNavigationOptions) => {
      // If history is false, disable fetching history for faster navigation
      if (options?.history === false) {
        updateMessages(agentId, threadId ?? agentId);
      }

      const pathname = withBasePath(getEditAgentPath(agentId, threadId));
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
      navigate(url);
    },
    [navigate, withBasePath, history, updateMessages],
  );
};

export const useFocusChat = () => {
  const navigate = useNavigate();
  const withBasePath = useBasePath();
  const updateMessages = useUpdateThreadMessages();

  const navigateToAgent = useCallback(
    (agentId: string, threadId: string, options?: AgentNavigationOptions) => {
      // If history is false, disable fetching history for faster navigation
      if (options?.history === false) {
        updateMessages(agentId, threadId);
      }

      const pathname = withBasePath(getChatPath(agentId, threadId));
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
      navigate(url);
    },
    [withBasePath, navigate, history, updateMessages],
  );

  return navigateToAgent;
};

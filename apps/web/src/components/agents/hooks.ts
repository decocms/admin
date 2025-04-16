import { useCallback } from "react";
import { useNavigate } from "react-router";
import { getThreadId } from "../../hooks/thread.ts";
import { useBasePath } from "../../hooks/useBasePath.ts";

// Helper to get agent URL
export const getChatPath = (
  agentId: string,
  threadId = getThreadId(),
): string => `/chat/${agentId}/${threadId}`;

export const getAgentEditPath = (agentId: string): string =>
  `/agent/${agentId}`;

interface Options {
  message?: string;
}

export const useFocusChat = () => {
  const navigate = useNavigate();
  const withBasePath = useBasePath();

  const navigateToAgent = useCallback(
    (
      agentId: string,
      threadId?: string,
      options?: Options,
    ) => {
      const url = new URL(
        withBasePath(getChatPath(agentId, threadId)),
        globalThis.location.origin,
      );

      if (options?.message) {
        url.searchParams.append("message", options.message);
      }

      navigate(`${url.pathname}${url.search}`);
    },
    [withBasePath, navigate],
  );

  return navigateToAgent;
};

export const useFocusAgent = () => {
  const navigate = useNavigate();
  const withBasePath = useBasePath();

  const navigateToAgent = useCallback(
    (agentId: string, options?: Options) => {
      const url = new URL(
        withBasePath(getAgentEditPath(agentId)),
        globalThis.location.origin,
      );

      if (options?.message) {
        url.searchParams.append("message", options.message);
      }

      navigate(`${url.pathname}${url.search}`);
    },
    [withBasePath, navigate],
  );

  return navigateToAgent;
};

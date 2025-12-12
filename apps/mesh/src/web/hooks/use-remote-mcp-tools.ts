/**
 * Hook to fetch tools from a remote MCP server URL
 *
 * Uses the useMcp hook to connect directly to the remote server
 * and extract the available tools.
 */

import { useMcp } from "use-mcp/react";

export interface UseRemoteMcpToolsOptions {
  /** The remote MCP server URL */
  url: string | null;
  /** Whether to enable the connection */
  enabled?: boolean;
}

export interface RemoteTool {
  name: string;
  description?: string;
}

/**
 * Hook to fetch tools from a remote MCP server
 *
 * @param options - URL and enabled flag
 * @returns Tools array and loading state
 */
export function useRemoteMcpTools({
  url,
  enabled = true,
}: UseRemoteMcpToolsOptions) {
  const shouldConnect = enabled && !!url;

  const mcp = useMcp({
    url: shouldConnect ? url : "",
    clientName: "MCP Store Preview",
    clientUri: typeof window !== "undefined" ? window.location.origin : "",
    autoReconnect: false,
    autoRetry: false,
  });

  const isLoading =
    shouldConnect &&
    (mcp.state === "connecting" ||
      mcp.state === "authenticating" ||
      mcp.state === "pending_auth");

  const isReady = shouldConnect && mcp.state === "ready";
  const hasError = shouldConnect && mcp.state === "failed";

  // Extract tools with proper typing
  const tools: RemoteTool[] = isReady
    ? (mcp.tools || []).map((t) => ({
        name: t.name,
        description: t.description,
      }))
    : [];

  return {
    tools,
    isLoading,
    isReady,
    hasError,
    error: hasError ? mcp.error : null,
  };
}


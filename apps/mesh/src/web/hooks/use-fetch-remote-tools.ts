/**
 * useFetchRemoteTools Hook
 *
 * Fetches tools from an external MCP server URL.
 * Used to preview tools for registry items that don't have pre-loaded tools.
 */

import { useQuery } from "@tanstack/react-query";
import { KEYS } from "../lib/query-keys";

export interface RemoteTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

interface FetchRemoteToolsResponse {
  tools: RemoteTool[];
  error?: string;
  message?: string;
}

interface UseFetchRemoteToolsOptions {
  /** The MCP server URL to fetch tools from */
  url: string | null | undefined;
  /** Optional headers to send with the request */
  headers?: Record<string, string>;
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Fetches tools from an external MCP server URL.
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useFetchRemoteTools({
 *   url: "https://mcp-server.example.com",
 *   enabled: !hasPreloadedTools,
 * });
 * ```
 */
export function useFetchRemoteTools(options: UseFetchRemoteToolsOptions) {
  const { url, headers, enabled = true } = options;

  return useQuery({
    queryKey: KEYS.remoteTools(url ?? ""),
    queryFn: async (): Promise<RemoteTool[]> => {
      if (!url) return [];

      const response = await fetch("/api/registry/tools", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ url, headers }),
      });

      // Always accept 200 OK responses, even with errors inside
      // The backend returns 200 with error details for graceful fallback
      if (!response.ok && response.status !== 200) {
        throw new Error(`Failed to fetch tools: ${response.status}`);
      }

      const data = (await response.json()) as FetchRemoteToolsResponse;
      
      // If there's an error in the response but we have tools, use them
      // Otherwise if there's an error, still return empty array (graceful fallback)
      if (data.error && (!data.tools || data.tools.length === 0)) {
        console.warn(`Failed to fetch tools from ${url}: ${data.message || data.error}`);
        return [];
      }

      return data.tools ?? [];
    },
    enabled: enabled && !!url,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1, // Only retry once since this is an external service
  });
}

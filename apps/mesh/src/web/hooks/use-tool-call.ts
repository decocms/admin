/**
 * useToolCall Hook
 *
 * Generic hook for calling MCP tools with React Query.
 * Provides caching, loading states, and error handling out of the box.
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { ToolCaller } from "../../tools/client";
import { KEYS } from "../lib/query-keys";

/**
 * Options for useToolCall hook
 */
export interface UseToolCallOptions<TInput, _TOutput> {
  /** The tool caller function to use */
  toolCaller: ToolCaller;
  /** The name of the tool to call */
  toolName: string;
  /** The input parameters for the tool */
  toolInputParams: TInput;
  /** Whether the query is enabled */
  enabled?: boolean;
  /** Cache time in milliseconds */
  staleTime?: number;
  /** Connection ID for cache isolation (prevents cache collisions when switching connections) */
  connectionId?: string;
}

/**
 * Generic hook for calling MCP tools with React Query
 *
 * @param options - Configuration for the tool call
 * @returns Query result with data, loading state, and error
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useToolCall({
 *   toolCaller: createToolCaller(),
 *   toolName: "COLLECTION_LLM_LIST",
 *   toolInputParams: { limit: 10 },
 * });
 * ```
 */
export function useToolCall<TInput, TOutput>(
  options: UseToolCallOptions<TInput, TOutput>,
) {
  const {
    toolCaller,
    toolName,
    toolInputParams,
    enabled = true,
    staleTime = 60_000,
    connectionId,
  } = options;

  // Memoize the input params to prevent unnecessary re-fetches
  const paramsKey = useMemo(
    () => JSON.stringify(toolInputParams),
    [toolInputParams],
  );

  return useQuery({
    queryKey: KEYS.toolCall(toolName, paramsKey, connectionId),
    queryFn: async () => {
      const result = await toolCaller(toolName, toolInputParams);
      return result as TOutput;
    },
    enabled,
    staleTime,
  });
}

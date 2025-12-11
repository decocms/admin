/**
 * useToolCall Hook
 *
 * Generic hook for calling MCP tools with React Query Suspense.
 * Provides caching and error handling via Suspense boundaries.
 * Note: This hook uses Suspense, so it must be wrapped in a Suspense boundary.
 */

import { useSuspenseQuery } from "@tanstack/react-query";
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
  /** Cache time in milliseconds */
  staleTime?: number;
}

/**
 * Generic hook for calling MCP tools with React Query Suspense
 *
 * @param options - Configuration for the tool call
 * @returns Query result with data (suspends during loading, throws on error)
 *
 * @example
 * ```tsx
 * <Suspense fallback={<Loader />}>
 *   <Component />
 * </Suspense>
 *
 * function Component() {
 *   const { data } = useToolCall({
 *     toolCaller: createToolCaller(),
 *     toolName: "COLLECTION_LLM_LIST",
 *     toolInputParams: { limit: 10 },
 *   });
 *   // data is guaranteed to be available here
 * }
 * ```
 */
export function useToolCall<TInput, TOutput>(
  options: UseToolCallOptions<TInput, TOutput>,
) {
  const { toolCaller, toolName, toolInputParams, staleTime = 60_000 } = options;

  // Serialize the input params for the query key
  const paramsKey = JSON.stringify(toolInputParams);

  return useSuspenseQuery({
    queryKey: KEYS.toolCall(toolName, paramsKey),
    queryFn: async () => {
      const result = await toolCaller(toolName, toolInputParams);
      return result as TOutput;
    },
    staleTime,
  });
}

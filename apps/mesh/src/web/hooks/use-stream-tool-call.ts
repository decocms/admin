/**
 * useStreamToolCall Hook
 *
 * Hook for calling MCP streamable tools that return ndjson streams.
 * Provides real-time updates as data chunks arrive from the server.
 */

import { useMemo } from "react";
import { createStreamingToolCaller } from "../../tools/client";
import {
  queryOptions,
  experimental_streamedQuery as streamedQuery,
  useQuery,
} from "@tanstack/react-query";

/**
 * Options for useStreamToolCall hook
 */
export interface UseStreamToolCallOptions<TInput, TOutput> {
  /** The connection ID for the MCP server (optional, uses mesh API if not provided) */
  connectionId?: string;
  /** The name of the streamable tool to call (should start with STREAM_) */
  toolName: string;
  /** The input parameters for the tool */
  toolInputParams: TInput;
  /** Whether the stream is enabled (default: true) */
  enabled?: boolean;
  /** Callback fired when new data arrives */
  onData?: (data: TOutput) => void;
  /** Callback fired when the stream completes */
  onComplete?: () => void;
  /** Callback fired when an error occurs */
  onError?: (error: Error) => void;
}

/**
 * Return type for useStreamToolCall hook
 */
export interface UseStreamToolCallResult<TOutput> {
  /** The latest data received from the stream */
  data: TOutput | null;
  /** Whether the stream is currently active */
  isStreaming: boolean;
  /** Any error that occurred during streaming */
  error: Error | null;
  /** Restart the stream (useful after errors or to refresh) */
  restart: () => void;
  /** Stop the current stream */
  stop: () => void;
}

/**
 * Hook for calling MCP streamable tools with real-time updates.
 *
 * @param options - Configuration for the stream
 * @returns Stream result with data, loading state, error, and controls
 *
 * @example
 * ```tsx
 * const { data, isStreaming, error, restart } = useStreamToolCall({
 *   connectionId: "my-connection",
 *   toolName: "STREAM_WORKFLOW_EXECUTION_GET",
 *   toolInputParams: { id: executionId },
 *   onData: (data) => console.log("Got update:", data),
 * });
 *
 * if (isStreaming) return <Spinner />;
 * if (error) return <ErrorMessage error={error} />;
 * if (!data) return <EmptyState />;
 *
 * return <ExecutionView execution={data.item} />;
 * ```
 */
export function useStreamToolCall<TInput, TOutput>(
  options: UseStreamToolCallOptions<TInput, TOutput>,
) {
  const {
    connectionId,
    toolName,
    toolInputParams,
    enabled = true,
    onData,
    onComplete,
    onError,
  } = options;

  const paramsKey = useMemo(
    () => JSON.stringify(toolInputParams),
    [toolInputParams],
  );

  const query = queryOptions({
    queryKey: [toolName, paramsKey],
    enabled,
    staleTime: Infinity,
    queryFn: streamedQuery({
      streamFn: async function* () {
        try {
          const streamCaller = createStreamingToolCaller(connectionId);
          for await (const chunk of streamCaller<TOutput>(
            toolName,
            toolInputParams,
          )) {
            onData?.(chunk);
            yield chunk;
          }
          onComplete?.();
        } catch (error) {
          onError?.(error as Error);
          throw error;
        }
      },
    }),
  });

  return useQuery({
    ...query,
    enabled,
    select: (data) => {
      if (!data.length) return undefined;

      // Get the latest response as the base
      const latest = data[data.length - 1] as TOutput;

      // Check if this is a workflow execution response with stream_chunks
      if (
        latest &&
        typeof latest === "object" &&
        "item" in latest &&
        latest.item &&
        typeof latest.item === "object"
      ) {
        // Accumulate all stream_chunks from all responses
        const allChunks = new Map<string, unknown>();

        for (const response of data) {
          const resp = response as {
            item?: {
              stream_chunks?: Array<{
                id: string;
                chunk_index: number;
                [key: string]: unknown;
              }>;
            };
          };
          if (resp?.item?.stream_chunks) {
            for (const chunk of resp.item.stream_chunks) {
              allChunks.set(chunk.id, chunk);
            }
          }
        }

        // Sort chunks by chunk_index and merge into latest response
        const sortedChunks = Array.from(allChunks.values()).sort(
          (a, b) =>
            (a as { chunk_index: number }).chunk_index -
            (b as { chunk_index: number }).chunk_index,
        );

        return {
          ...latest,
          item: {
            ...(latest as { item: object }).item,
            stream_chunks: sortedChunks.length > 0 ? sortedChunks : undefined,
          },
        } as TOutput;
      }

      // For non-workflow responses, just return the latest
      return latest;
    },
  });
}

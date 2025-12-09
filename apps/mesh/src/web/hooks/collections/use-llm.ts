/**
 * LLM Collection Hooks
 *
 * Provides React hooks for working with LLM models from remote connections
 * using TanStack DB collections and live queries.
 */

import type { ModelCollectionEntitySchema } from "@decocms/bindings/llm";
import { z } from "zod";
import { UNKNOWN_CONNECTION_ID, createToolCaller } from "../../../tools/client";
import {
  useCollection,
  useCollectionList,
  type UseCollectionListOptions,
} from "../use-collections";

// LLM type matching ModelSchema from @decocms/bindings
export type LLM = z.infer<typeof ModelCollectionEntitySchema>;

/**
 * Options for useLLMsFromConnection hook
 */
export type UseLLMsOptions = UseCollectionListOptions<LLM>;

/**
 * Hook to get all LLM models from a specific connection with live query reactivity
 *
 * @param connectionId - The ID of the connection to fetch LLMs from
 * @param options - Filter and configuration options
 * @returns Live query result with LLMs
 */
export function useLLMsFromConnection(
  connectionId: string | undefined,
  options: UseLLMsOptions = {},
) {
  // Use a placeholder ID when connectionId is undefined to ensure hooks are always called
  // in the same order (Rules of Hooks compliance)
  const toolCaller = createToolCaller(connectionId ?? UNKNOWN_CONNECTION_ID);

  const collection = useCollection<LLM>(
    connectionId ?? UNKNOWN_CONNECTION_ID,
    "LLM",
    toolCaller,
  );
  return useCollectionList(collection, options);
}

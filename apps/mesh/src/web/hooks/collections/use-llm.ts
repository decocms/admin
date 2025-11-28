/**
 * LLM Collection Hooks
 *
 * Provides React hooks for working with LLM models from remote connections
 * using TanStack DB collections and live queries.
 */

import { UNKNOWN_CONNECTION_ID } from "../../../tools/client";
import {
  useCollection,
  useCollectionList,
  type UseCollectionListOptions,
} from "../use-collections";

// LLM type matching ModelSchema from @decocms/bindings
export interface LLM {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  logo: string | null;
  description: string | null;
  capabilities: string[];
  limits: {
    contextWindow: number;
    maxOutputTokens: number;
  } | null;
  costs: {
    input: number;
    output: number;
  } | null;
  provider:
    | "openai"
    | "anthropic"
    | "google"
    | "xai"
    | "deepseek"
    | "openai-compatible"
    | "openrouter"
    | null;
  endpoint: {
    url: string;
    method: string;
    contentType: string;
    stream: boolean;
  } | null;
}

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
  const collection = useCollection<LLM>(
    connectionId ?? UNKNOWN_CONNECTION_ID,
    "LLM",
  );
  const result = useCollectionList(collection, options);

  // Return empty state if no connectionId was provided
  if (!connectionId) {
    return {
      data: [] as LLM[],
      isPending: false,
      isError: false,
      error: null,
    };
  }

  return result;
}

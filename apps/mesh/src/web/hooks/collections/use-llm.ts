/**
 * LLM Collection Hooks
 *
 * Provides React hooks for working with LLM models from remote connections
 * using TanStack DB collections and live queries.
 */

import { createToolCaller, UNKNOWN_CONNECTION_ID } from "../../../tools/client";
import {
  createCollectionFromToolCaller,
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

// Cache for LLM collections per connection
const llmCollectionCache = new Map<
  string,
  ReturnType<typeof createCollectionFromToolCaller<LLM>>
>();

/**
 * Get or create an LLM collection for a specific connection.
 * Collections are cached per connectionId.
 */
function getOrCreateLLMCollection(connectionId: string) {
  let collection = llmCollectionCache.get(connectionId);

  if (!collection) {
    collection = createCollectionFromToolCaller<LLM>({
      toolCaller: createToolCaller(connectionId),
      collectionName: "LLM",
    });
    llmCollectionCache.set(connectionId, collection);
  }

  return collection;
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
  const collection = getOrCreateLLMCollection(
    connectionId ?? UNKNOWN_CONNECTION_ID,
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

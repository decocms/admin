/**
 * Models Hooks
 *
 * Provides React hooks for working with models from remote connections
 * using TanStack DB collections and live queries.
 */

import { createToolCaller } from "../../tools/client";
import {
  createCollectionFromToolCaller,
  useCollectionList,
  type UseCollectionListOptions,
} from "./use-collections";

// Model type matching ModelSchema from @decocms/bindings
export interface Model {
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

// Cache for models collections per connection
const modelsCollectionCache = new Map<
  string,
  ReturnType<typeof createCollectionFromToolCaller<Model>>
>();

/**
 * Get or create a models collection for a specific connection.
 * Collections are cached per connectionId.
 */
function getOrCreateModelsCollection(connectionId: string) {
  let collection = modelsCollectionCache.get(connectionId);

  if (!collection) {
    collection = createCollectionFromToolCaller<Model>({
      toolCaller: createToolCaller(connectionId),
      collectionName: "MODELS",
    });
    modelsCollectionCache.set(connectionId, collection);
  }

  return collection;
}

/**
 * Options for useModelsFromConnection hook
 */
export type UseModelsOptions = UseCollectionListOptions<Model>;

/**
 * Hook to get all models from a specific connection with live query reactivity
 *
 * @param connectionId - The ID of the connection to fetch models from
 * @param options - Filter and configuration options
 * @returns Live query result with models
 */
export function useModelsFromConnection(
  connectionId: string | undefined,
  options: UseModelsOptions = {},
) {
  // Return empty state if no connectionId
  if (!connectionId) {
    return {
      data: [] as Model[],
      isPending: false,
      isError: false,
      error: null,
    };
  }

  const collection = getOrCreateModelsCollection(connectionId);
  return useCollectionList(collection, options);
}

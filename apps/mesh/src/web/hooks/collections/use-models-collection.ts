/**
 * useModelsCollection Hook
 *
 * Specialized hook for working with the MODELS collection
 * This is an example of creating domain-specific hooks on top of the base collection hooks
 */

import { useMemo } from "react";
import { useCollectionQuery } from "./use-collection-query";
import type { UseCollectionQueryOptions } from "./types";

/**
 * Model type matching ModelSchema from @decocms/bindings
 */
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
    | null;
  endpoint: {
    url: string;
    method: string;
    contentType: string;
    stream: boolean;
  } | null;
}

/**
 * Transformed model for UI consumption
 */
export interface TransformedModel {
  id: string;
  model: string;
  name: string;
  logo: string | null;
  description: string | null;
  capabilities: string[];
  inputCost: number | null;
  outputCost: number | null;
  contextWindow: number | null;
  outputLimit: number | null;
  provider: Model["provider"];
  endpoint: Model["endpoint"];
}

/**
 * Provider logo mapping
 */
const PROVIDER_LOGOS: Record<string, string> = {
  anthropic:
    "https://api.dicebear.com/7.x/initials/svg?seed=Anthropic&backgroundColor=D97706",
  openai:
    "https://api.dicebear.com/7.x/initials/svg?seed=OpenAI&backgroundColor=10B981",
  google:
    "https://api.dicebear.com/7.x/initials/svg?seed=Google&backgroundColor=3B82F6",
  "x-ai":
    "https://api.dicebear.com/7.x/initials/svg?seed=xAI&backgroundColor=8B5CF6",
};

/**
 * Known visual capabilities to display
 */
const KNOWN_CAPABILITIES = new Set([
  "reasoning",
  "image-upload",
  "file-upload",
  "web-search",
]);

/**
 * Transform a raw model to UI format
 */
function transformModel(model: Model): TransformedModel {
  // Extract provider from model id (e.g., "anthropic/claude-3.5-sonnet" → "anthropic")
  const provider = model.id.split("/")[0] || "";
  const logo = model.logo || PROVIDER_LOGOS[provider] || null;

  // Filter capabilities to only show known visual ones
  const capabilities = model.capabilities.filter((cap) =>
    KNOWN_CAPABILITIES.has(cap),
  );

  // Convert costs from per-token to per-1M-tokens (multiply by 1,000,000)
  const inputCost = model.costs?.input ? model.costs.input * 1_000_000 : null;
  const outputCost = model.costs?.output
    ? model.costs.output * 1_000_000
    : null;

  return {
    id: model.id,
    model: model.title,
    name: model.title,
    logo,
    description: model.description,
    capabilities,
    inputCost,
    outputCost,
    contextWindow: model.limits?.contextWindow ?? null,
    outputLimit: model.limits?.maxOutputTokens ?? null,
    provider: model.provider,
    endpoint: model.endpoint,
  };
}

/**
 * Hook to query the MODELS collection with automatic transformation
 *
 * @example
 * ```tsx
 * const { models, isLoading, error } = useModelsCollection({
 *   connectionId: connection.id,
 *   enabled: Boolean(connection),
 * });
 *
 * // With filtering
 * const { models } = useModelsCollection({
 *   connectionId: connection.id,
 *   queryOptions: {
 *     where: [
 *       { field: 'provider', operator: 'eq', value: 'anthropic' }
 *     ]
 *   }
 * });
 * ```
 */
export function useModelsCollection(
  options: Omit<UseCollectionQueryOptions<Model>, "collectionName">,
) {
  const query = useCollectionQuery<Model>({
    ...options,
    collectionName: "MODELS",
  });

  // Transform models for UI consumption
  const models = useMemo(() => {
    if (
      !query.data ||
      typeof query.data !== "object" ||
      !("items" in query.data)
    )
      return [];
    if (!("items" in query.data) || !Array.isArray(query.data.items)) return [];
    return query.data.items!.map(transformModel);
  }, [query.data]);

  return {
    models,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    // Expose raw query for advanced use cases
    query,
  };
}

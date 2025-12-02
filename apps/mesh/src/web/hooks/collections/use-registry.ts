/**
 * Registry Collection Hooks
 *
 * Provides React hooks for working with registries using TanStack DB collections
 * and live queries. These hooks offer a reactive interface for accessing registries.
 */

import { createToolCaller } from "../../../tools/client";
import {
  type CollectionFilter,
  createCollectionFromToolCaller,
  useCollectionItem,
  useCollectionList,
  type UseCollectionListOptions,
} from "../use-collections";

/**
 * Registry entity type matching the registry collection binding pattern
 */
export interface Registry {
  id: string;
  title: string;
  description?: string | null;
  icon?: string | null;
  url?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

// Module-level singleton to store the collection instance
let registryCollectionSingleton: ReturnType<
  typeof createCollectionFromToolCaller<Registry>
> | null = null;

/**
 * Get or create the registry collection singleton.
 * This is at module scope to ensure true singleton behavior.
 */
function getOrCreateRegistryCollection() {
  registryCollectionSingleton ??=
    createCollectionFromToolCaller<Registry>({
      toolCaller: createToolCaller(),
      collectionName: "REGISTRY",
    });

  return registryCollectionSingleton;
}

/**
 * Hook to get the registry collection
 *
 * Uses createToolCaller() (no connectionId) to route to the mesh API.
 * The collection is a singleton shared across all components.
 *
 * @returns The registry collection with CRUD operations
 */
export function useRegistryCollection() {
  const collection = getOrCreateRegistryCollection();
  if (!collection) {
    throw new Error("Failed to initialize registry collection");
  }
  return collection;
}

/**
 * Filter definition for registries (matches @deco/ui Filter shape)
 */
export type RegistryFilter = CollectionFilter;

/**
 * Options for useRegistries hook
 */
export type UseRegistriesOptions = UseCollectionListOptions<Registry>;

/**
 * Hook to get all registries with live query reactivity
 *
 * @param options - Filter and configuration options
 * @returns Live query result with registries as Registry[], plus the original collection for mutations
 */
export function useRegistries(options: UseRegistriesOptions = {}) {
  const collection = useRegistryCollection();
  return useCollectionList(collection, options);
}

/**
 * Hook to get a single registry by ID with live query reactivity
 *
 * @param registryId - The ID of the registry to fetch
 * @returns Live query result with the registry as Registry, plus the original collection for mutations
 */
export function useRegistry(registryId: string | undefined) {
  const collection = useRegistryCollection();
  return useCollectionItem(collection, registryId);
}


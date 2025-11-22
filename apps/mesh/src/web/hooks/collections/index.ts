/**
 * Collection Hooks
 *
 * Re-export all collection hooks and utilities for easy importing
 */

// Core collection hooks
export { useCollectionQuery } from "./use-collection-query";
export { useCollectionItem } from "./use-collection-item";
export { useCollectionMutations } from "./use-collection-mutations";

// Specialized collection hooks
export {
  useModelsCollection,
  type Model,
  type TransformedModel,
} from "./use-models-collection";
export {
  useConnectionCollections,
  useHasCollection,
  type DiscoveredCollection,
} from "./use-connection-collections";

// Types and utilities
export * from "./types";
export * from "./utils";


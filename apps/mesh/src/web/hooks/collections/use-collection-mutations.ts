/**
 * useCollectionMutations Hook
 *
 * React Query mutations for collection CUD operations (Create, Update, Delete)
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createConnectionToolCaller } from "@/tools/client";
import type {
  BatchOperationInput,
  CreateItemInput,
  DeleteItemInput,
  UpdateItemInput,
  UseCollectionMutationsOptions,
} from "./types";
import { collectionTools, getCollectionKeyPrefix } from "./utils";

/**
 * Hook to perform mutations on a collection
 *
 * @example
 * ```tsx
 * const mutations = useCollectionMutations({
 *   connectionId: connection.id,
 *   collectionName: 'MODELS',
 *   invalidateOnSuccess: true,
 * });
 *
 * // Create an item
 * await mutations.createItem.mutateAsync({
 *   item: {
 *     id: 'custom-model',
 *     title: 'My Custom Model',
 *     provider: 'openai-compatible',
 *   }
 * });
 *
 * // Update an item
 * await mutations.updateItem.mutateAsync({
 *   id: 'custom-model',
 *   changes: { title: 'Updated Title' }
 * });
 *
 * // Delete an item
 * await mutations.deleteItem.mutateAsync({ id: 'custom-model' });
 * ```
 */
export function useCollectionMutations<T = unknown>(
  options: UseCollectionMutationsOptions,
) {
  const {
    connectionId,
    collectionName,
    onCreateSuccess,
    onUpdateSuccess,
    onDeleteSuccess,
    invalidateOnSuccess = true,
  } = options;

  const queryClient = useQueryClient();

  // Helper to invalidate all collection queries
  const invalidateCollection = () => {
    if (invalidateOnSuccess) {
      const keyPrefix = getCollectionKeyPrefix({ connectionId, collectionName });
      void queryClient.invalidateQueries({ queryKey: keyPrefix });
    }
  };

  // Create mutation
  const createItem = useMutation({
    mutationFn: async (input: CreateItemInput<T>) => {
      const callTool = createConnectionToolCaller(connectionId);
      const toolName = collectionTools.create(collectionName);
      return await callTool(toolName, input);
    },
    onSuccess: (data) => {
      invalidateCollection();
      onCreateSuccess?.(data);
    },
  });

  // Update mutation
  const updateItem = useMutation({
    mutationFn: async (input: UpdateItemInput<T>) => {
      const callTool = createConnectionToolCaller(connectionId);
      const toolName = collectionTools.update(collectionName);
      return await callTool(toolName, input);
    },
    onSuccess: (data) => {
      invalidateCollection();
      onUpdateSuccess?.(data);
    },
  });

  // Delete mutation
  const deleteItem = useMutation({
    mutationFn: async (input: DeleteItemInput) => {
      const callTool = createConnectionToolCaller(connectionId);
      const toolName = collectionTools.delete(collectionName);
      return await callTool(toolName, input);
    },
    onSuccess: (_, variables) => {
      invalidateCollection();
      onDeleteSuccess?.(variables.id);
    },
  });

  // Batch mutation (if supported by the collection)
  const batchOperation = useMutation({
    mutationFn: async (input: BatchOperationInput<T>) => {
      const callTool = createConnectionToolCaller(connectionId);
      const toolName = collectionTools.batch(collectionName);
      return await callTool(toolName, input);
    },
    onSuccess: () => {
      invalidateCollection();
    },
  });

  return {
    createItem,
    updateItem,
    deleteItem,
    batchOperation,
  };
}


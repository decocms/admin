import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CREATE_NAMESPACEInput,
  DELETE_NAMESPACEInput,
  DIFF_NAMESPACEInput,
  DIFF_NAMESPACEOutput,
  LIST_FILESOutput,
  LIST_NAMESPACESOutput,
  MERGE_NAMESPACEInput,
  MERGE_NAMESPACEOutput,
  READ_FILEInput
} from "../../../server/deco.gen";
import { client } from "../lib/rpc";

// Types for easier use
export type Namespace = LIST_NAMESPACESOutput["namespaces"][0];
export type FileInfo = LIST_FILESOutput["files"][string];
export type NamespaceDiff = DIFF_NAMESPACEOutput["differences"][0];
export type MergeResult = MERGE_NAMESPACEOutput;

// List namespaces
export const useListNamespaces = (prefix?: string) => {
  return useQuery({
    queryKey: ["namespaces", { prefix }],
    queryFn: () => client.LIST_NAMESPACES({ prefix }),
  });
};

// Create namespace
export const useCreateNamespace = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (input: CREATE_NAMESPACEInput) => client.CREATE_NAMESPACE(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["namespaces"] });
    },
  });
};

// Delete namespace
export const useDeleteNamespace = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (input: DELETE_NAMESPACEInput) => client.DELETE_NAMESPACE(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["namespaces"] });
      queryClient.invalidateQueries({ queryKey: ["files"] });
    },
  });
};

// Merge namespaces
export const useMergeNamespace = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (input: MERGE_NAMESPACEInput) => client.MERGE_NAMESPACE(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["namespaces"] });
      queryClient.invalidateQueries({ queryKey: ["files"] });
    },
  });
};

// Diff namespaces
export const useDiffNamespace = () => {
  return useMutation({
    mutationFn: (input: DIFF_NAMESPACEInput) => client.DIFF_NAMESPACE(input),
  });
};

// List files in a namespace
export const useListFiles = (namespace?: string, prefix?: string) => {
  return useQuery({
    queryKey: ["files", { namespace, prefix }],
    queryFn: () => client.LIST_FILES({ namespace, prefix }),
    enabled: !!namespace,
  });
};

// Read file content
export const useReadFile = () => {
  return useMutation({
    mutationFn: (input: READ_FILEInput) => client.READ_FILE(input),
  });
}; 
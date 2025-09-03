import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CREATE_BRANCHInput,
  DELETE_BRANCHInput,
  DIFF_BRANCHInput,
  DIFF_BRANCHOutput,
  LIST_FILESOutput,
  LIST_BRANCHESOutput,
  MERGE_BRANCHInput,
  MERGE_BRANCHOutput,
  READ_FILEInput,
  PUT_FILEInput,
} from "../../../server/deco.gen";
import { client } from "../lib/rpc";

// Types for easier use
export type Branch = LIST_BRANCHESOutput["branches"][0];
export type FileInfo = LIST_FILESOutput["files"][string];
export type BranchDiff = DIFF_BRANCHOutput["differences"][0];
export type MergeResult = MERGE_BRANCHOutput;

// List branches
export const useListBranches = (prefix?: string) => {
  return useQuery({
    queryKey: ["branches", { prefix }],
    queryFn: () => client.LIST_BRANCHES({ prefix }),
  });
};

// Create branch
export const useCreateBranch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CREATE_BRANCHInput) => client.CREATE_BRANCH(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
    },
  });
};

// Delete branch
export const useDeleteBranch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: DELETE_BRANCHInput) => client.DELETE_BRANCH(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      queryClient.invalidateQueries({ queryKey: ["files"] });
    },
  });
};

// Merge branches
export const useMergeBranch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: MERGE_BRANCHInput) => client.MERGE_BRANCH(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      queryClient.invalidateQueries({ queryKey: ["files"] });
    },
  });
};

// Diff branches
export const useDiffBranch = () => {
  return useMutation({
    mutationFn: (input: DIFF_BRANCHInput) => client.DIFF_BRANCH(input),
  });
};

// List files in a branch
export const useListFiles = (branch?: string, prefix?: string) => {
  return useQuery({
    queryKey: ["files", { branch, prefix }],
    queryFn: () => client.LIST_FILES({ branch, prefix }),
    enabled: !!branch,
  });
};

// Read file content
export const useReadFile = () => {
  return useMutation({
    mutationFn: (input: READ_FILEInput) => client.READ_FILE(input),
  });
};

// Put/Create file
export const usePutFile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: PUT_FILEInput) => client.PUT_FILE(input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["files", { branch: variables.branch }],
      });
    },
  });
};

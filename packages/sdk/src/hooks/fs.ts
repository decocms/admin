import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteFile, readDirectory, readFile, writeFile } from "../crud/fs.tsx";
import { type FileSystemOptions } from "../index.ts";
import { KEYS } from "./api.ts";

export const useFile = (path: string, options?: FileSystemOptions) => {
  return useQuery({
    queryKey: KEYS.FILE(path, options),
    queryFn: () => readFile(path, options),
  });
};

export const useDirectory = (path: string, options?: FileSystemOptions) => {
  return useQuery({
    queryKey: KEYS.FILE(path, options),
    queryFn: () => readDirectory(path, options),
  });
};

export const useWriteFile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      path,
      content,
      options,
    }: {
      path: string;
      content: string | Uint8Array;
      options?: FileSystemOptions;
    }) => writeFile(path, content, options),
    onMutate: async ({
      path,
      content,
      options,
    }: {
      path: string;
      content: string | Uint8Array;
      options?: FileSystemOptions;
    }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: KEYS.FILE(path, options) });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData(KEYS.FILE(path, options));

      // Optimistically update to the new value
      queryClient.setQueryData(KEYS.FILE(path, options), () => ({
        path,
        content,
        exists: true,
      }));

      return { previousData };
    },
    onError: (_err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousData) {
        queryClient.setQueryData(
          KEYS.FILE(variables.path, variables.options),
          context.previousData,
        );
      }
    },
    onSettled: (_, __, variables) => {
      // Always refetch after error or success to ensure data is in sync
      queryClient.invalidateQueries({
        queryKey: KEYS.FILE(variables.path, variables.options),
      });
    },
  });
};

export const useDeleteFile = (path: string, options?: FileSystemOptions) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deleteFile(path, options),
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: KEYS.FILE(path, options) });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData(KEYS.FILE(path, options));

      // Optimistically update to the new value
      queryClient.removeQueries({ queryKey: KEYS.FILE(path, options) });

      return { previousData };
    },
    onError: (_err, _variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousData) {
        queryClient.setQueryData(
          KEYS.FILE(path, options),
          context.previousData,
        );
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure data is in sync
      queryClient.invalidateQueries({ queryKey: KEYS.FILE(path, options) });
    },
  });
};

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteFile, readFile, writeFile } from "../crud/fs.tsx";
import { type FileSystemOptions } from "../index.ts";
import { KEYS } from "./keys.ts";

export const useFile = (path: string, options?: FileSystemOptions) => {
  return useQuery({
    queryKey: KEYS.file(path, options),
    queryFn: () => readFile(path, options),
  });
};

export const useWriteFile = (
  path: string,
  content: string,
  options?: FileSystemOptions,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => writeFile(path, content, options),
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: KEYS.file(path, options) });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData(KEYS.file(path, options));

      // Optimistically update to the new value
      queryClient.setQueryData(KEYS.file(path, options), () => ({
        path,
        content,
        exists: true,
      }));

      return { previousData };
    },
    onError: (_err, _variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousData) {
        queryClient.setQueryData(
          KEYS.file(path, options),
          context.previousData,
        );
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure data is in sync
      queryClient.invalidateQueries({ queryKey: KEYS.file(path, options) });
    },
  });
};

export const useDeleteFile = (path: string, options?: FileSystemOptions) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deleteFile(path, options),
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: KEYS.file(path, options) });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData(KEYS.file(path, options));

      // Optimistically update to the new value
      queryClient.removeQueries({ queryKey: KEYS.file(path, options) });

      return { previousData };
    },
    onError: (_err, _variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousData) {
        queryClient.setQueryData(
          KEYS.file(path, options),
          context.previousData,
        );
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure data is in sync
      queryClient.invalidateQueries({ queryKey: KEYS.file(path, options) });
    },
  });
};

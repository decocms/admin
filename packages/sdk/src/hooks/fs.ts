import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFile, deleteFile, readFile } from "../crud/fs.tsx";
import { type FileSystemOptions } from "../index.ts";

const getKeyFor = (
  path: string,
  options?: FileSystemOptions,
) => ["file", path, options];

/**
 * Reads the contents of a file.
 *
 * @example
 * ```typescript
 * const { data, isLoading, error } = useFile("/path/to/file");
 * ```
 *
 * @param path - Path to the file to read
 * @returns Object containing the file contents, loading state, and error state
 */
export const useFile = (path: string, options?: FileSystemOptions) => {
  return useQuery({
    queryKey: getKeyFor(path, options),
    queryFn: () => readFile(path, options),
  });
};

export const useCreateFile = (path: string, options?: FileSystemOptions) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => createFile(path, options),
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: getKeyFor(path, options) });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData(getKeyFor(path, options));

      // Optimistically update to the new value
      queryClient.setQueryData(getKeyFor(path, options), () => ({
        path,
        content: "",
        exists: true,
      }));

      return { previousData };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousData) {
        queryClient.setQueryData(
          getKeyFor(path, options),
          context.previousData,
        );
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure data is in sync
      queryClient.invalidateQueries({ queryKey: getKeyFor(path, options) });
    },
  });
};

export const useDeleteFile = (path: string, options?: FileSystemOptions) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deleteFile(path, options),
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: getKeyFor(path, options) });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData(getKeyFor(path, options));

      // Optimistically update to the new value
      queryClient.setQueryData(getKeyFor(path, options), () => ({
        path,
        content: "",
        exists: false,
      }));

      return { previousData };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousData) {
        queryClient.setQueryData(
          getKeyFor(path, options),
          context.previousData,
        );
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure data is in sync
      queryClient.invalidateQueries({ queryKey: getKeyFor(path, options) });
    },
  });
};

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteFile, readDirectory, readFile, writeFile } from "../crud/fs.tsx";
import { type FileSystemOptions } from "../index.ts";

const getKeyFor = (
  path: string,
  options?: FileSystemOptions,
) => ["file", path, options];

export const useFile = (path: string, options?: FileSystemOptions) => {
  return useQuery({
    queryKey: getKeyFor(path, options),
    queryFn: () => readFile(path, options),
  });
};

export const useDirectory = (path: string, options?: FileSystemOptions) => {
  return useQuery({
    queryKey: getKeyFor(path, options),
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
      await queryClient.cancelQueries({ queryKey: getKeyFor(path, options) });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData(getKeyFor(path, options));

      // Optimistically update to the new value
      queryClient.setQueryData(getKeyFor(path, options), () => ({
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
          getKeyFor(variables.path, variables.options),
          context.previousData,
        );
      }
    },
    onSettled: (_, __, variables) => {
      // Always refetch after error or success to ensure data is in sync
      queryClient.invalidateQueries({
        queryKey: getKeyFor(variables.path, variables.options),
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
      await queryClient.cancelQueries({ queryKey: getKeyFor(path, options) });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData(getKeyFor(path, options));

      // Optimistically update to the new value
      queryClient.removeQueries({ queryKey: getKeyFor(path, options) });

      return { previousData };
    },
    onError: (_err, _variables, context) => {
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

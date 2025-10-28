import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteFile, listFiles, readFile, writeFile } from "../crud/fs.tsx";
import { useSDK } from "../index.ts";
import { KEYS } from "./react-query-keys.ts";

export const useFile = (path: string) => {
  const { locator } = useSDK();

  return useQuery({
    queryKey: KEYS.FILE(locator, path),
    queryFn: () => readFile({ locator: locator, path }),
  });
};

export const useReadFile = () => {
  const queryClient = useQueryClient();
  const { locator } = useSDK();

  return (path: string, { expiresIn }: { expiresIn?: number } = {}) =>
    queryClient.fetchQuery({
      queryKey: KEYS.FILE(locator, path),
      queryFn: () => readFile({ locator: locator, path, expiresIn }),
    });
};

export const useFiles = ({ root }: { root: string }) => {
  const { locator } = useSDK();

  return useQuery({
    queryKey: KEYS.FILE(locator, root),
    queryFn: () => listFiles({ locator: locator, root }),
  });
};

export const useWriteFile = () => {
  const queryClient = useQueryClient();
  const { locator } = useSDK();

  return useMutation({
    mutationFn: ({
      path,
      content,
      contentType,
      metadata,
    }: {
      path: string;
      content: Uint8Array;
      contentType: string;
      metadata?: Record<string, string | string[]>;
    }) => writeFile({ path, locator: locator, content, contentType, metadata }),
    onMutate: async ({ path, content, contentType, metadata }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: KEYS.FILE(locator, path) });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData(KEYS.FILE(locator, path));

      // Optimistically update to the new value
      queryClient.setQueryData(KEYS.FILE(locator, path), () => ({
        path,
        content,
        contentType,
        exists: true,
        metadata,
      }));

      return { previousData };
    },
    onError: (_err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousData) {
        queryClient.setQueryData(
          KEYS.FILE(locator, variables.path),
          context.previousData,
        );
      }
    },
    onSettled: (_, __, variables) => {
      // Always refetch after error or success to ensure data is in sync
      queryClient.invalidateQueries({
        queryKey: KEYS.FILE(locator, variables.path),
      });
    },
  });
};

interface DeleteFileParams {
  path: string;
  /* prefix root to revalited useFiles */
  root?: string;
}

export const useDeleteFile = () => {
  const { locator } = useSDK();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ path }: DeleteFileParams) =>
      deleteFile({ locator: locator, path }),
    onSuccess: (_, { root }) => {
      if (!root) return;

      const rootKey = KEYS.FILE(locator, root);

      queryClient.invalidateQueries({ queryKey: rootKey });
    },
  });
};

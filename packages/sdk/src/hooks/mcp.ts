import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  createIntegration,
  deleteIntegration,
  listIntegrations,
  loadIntegration,
  saveIntegration,
} from "../crud/mcp.ts";
import type { Integration } from "../models/mcp.ts";
import { useSDK } from "./store.tsx";

const getKeyFor = (
  context: string,
  mcpId?: string,
) => ["mcp", context, mcpId];

export const useCreateIntegration = () => {
  const { state: { context, client } } = useSDK();

  const create = useMutation({
    mutationFn: (mcp: Integration) => createIntegration(context, mcp),
    onSuccess: (result) => {
      const key = getKeyFor(context, result.id);

      // update item
      client.setQueryData(key, result);

      // update list
      client.setQueryData(getKeyFor(context), (old: Integration[] | undefined) => {
        if (!old) return [result];
        return [...old, result];
      });

      // invalidate list
      client.invalidateQueries({ queryKey: getKeyFor(context) });
    },
  });

  return create;
};

export const useUpdateIntegration = () => {
  const { state: { context: root, client } } = useSDK();

  const update = useMutation({
    mutationFn: (mcp: Integration) => saveIntegration(root, mcp),
    onMutate: async (updatedMCP) => {
      // Cancel any outgoing refetches
      await client.cancelQueries({ queryKey: getKeyFor(root) });

      // Snapshot the previous value
      const previousMCPs = client.getQueryData(getKeyFor(root)) as
        | Integration[]
        | undefined;

      // Optimistically update the cache
      client.setQueryData(getKeyFor(root), (old: Integration[] | undefined) => {
        if (!old) return [updatedMCP];
        return old.map((mcp) =>
          mcp.id === updatedMCP.id ? updatedMCP : mcp
        );
      });

      // Update the individual MCP in cache
      client.setQueryData(getKeyFor(root, updatedMCP.id), updatedMCP);

      return { previousMCPs } as const;
    },
    onError: (_err, _updatedMCP, context) => {
      // Rollback to the previous value
      if (context?.previousMCPs) {
        client.setQueryData(getKeyFor(root), context.previousMCPs);
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure data is in sync
      client.invalidateQueries({ queryKey: getKeyFor(root) });
    },
  });

  return update;
};

export const useRemoveIntegration = () => {
  const { state: { context: root, client } } = useSDK();

  const remove = useMutation({
    mutationFn: (mcpId: string) => deleteIntegration(root, mcpId),
    onMutate: async (mcpId) => {
      // Cancel any outgoing refetches
      await client.cancelQueries({ queryKey: getKeyFor(root) });

      // Snapshot the previous value
      const previousMCPs = client.getQueryData<Integration[]>(getKeyFor(root));

      // Optimistically update the cache
      client.setQueryData(getKeyFor(root), (old: Integration[]) => {
        if (!old) return old;
        return old.filter((mcp: Integration) => mcp.id !== mcpId);
      });

      // Remove the individual MCP from cache
      client.setQueryData(getKeyFor(root, mcpId), null);

      return { previousMCPs };
    },
    onError: (_err, _vars, ctx) => {
      // Rollback to the previous value
      if (ctx?.previousMCPs) {
        client.setQueryData(getKeyFor(root), ctx.previousMCPs);
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure data is in sync
      client.invalidateQueries({ queryKey: getKeyFor(root) });
    },
  });

  return remove;
};

/** Hook for crud-like operations on MCPs */
export const useIntegration = (mcpId: string) => {
  const { state: { context } } = useSDK();

  const data = useSuspenseQuery({
    queryKey: getKeyFor(context, mcpId),
    queryFn: () => loadIntegration(context, mcpId),
  });

  return data;
};

/** Hook for listing all MCPs */
export const useIntegrations = () => {
  const { state: { context } } = useSDK();

  const data = useSuspenseQuery({
    queryKey: getKeyFor(context),
    queryFn: () => listIntegrations(context).then((r) => r.items),
  });

  return data;
};

export const useIntegrationRoot = (mcpId: string) => {
  const { state: { context } } = useSDK();

  return useMemo(() => {
    if (!context) {
      return null;
    }

    return `${context}/Integrations/${mcpId}`;
  }, [context]);
};

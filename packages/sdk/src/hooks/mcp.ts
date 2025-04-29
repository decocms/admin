import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  createIntegration,
  deleteIntegration,
  IntegrationNotFoundError,
  listIntegrations,
  loadIntegration,
  saveIntegration,
} from "../crud/mcp.ts";
import type { Integration } from "../models/mcp.ts";
import { useAgentStub } from "./agent.ts";
import { KEYS } from "./api.ts";
import { useSDK } from "./store.tsx";

export const useCreateIntegration = () => {
  const client = useQueryClient();
  const { workspace } = useSDK();

  const create = useMutation({
    mutationFn: (mcp: Partial<Integration>) =>
      createIntegration(workspace, mcp),
    onSuccess: (result) => {
      // update item
      const itemKey = KEYS.INTEGRATION(workspace, result.id);
      client.cancelQueries({ queryKey: itemKey });
      client.setQueryData<Integration>(itemKey, result);

      // update list
      const listKey = KEYS.INTEGRATION(workspace);
      client.cancelQueries({ queryKey: listKey });
      client.setQueryData<Integration[]>(
        listKey,
        (old) => !old ? [result] : [result, ...old],
      );
    },
  });

  return create;
};

export const useUpdateIntegration = () => {
  const client = useQueryClient();
  const { workspace } = useSDK();

  const update = useMutation({
    mutationFn: (mcp: Integration) => saveIntegration(workspace, mcp),
    onSuccess: (result) => {
      // Update the individual MCP in cache
      const itemKey = KEYS.INTEGRATION(workspace, result.id);
      client.cancelQueries({ queryKey: itemKey });
      client.setQueryData<Integration>(itemKey, result);

      // Update the list
      const listKey = KEYS.INTEGRATION(workspace);
      client.cancelQueries({ queryKey: listKey });
      client.setQueryData<Integration[]>(
        listKey,
        (old) =>
          !old
            ? [result]
            : old.map((mcp) => mcp.id === result.id ? result : mcp),
      );
    },
  });

  return update;
};

export const useRemoveIntegration = () => {
  const client = useQueryClient();
  const { workspace } = useSDK();

  const remove = useMutation({
    mutationFn: (id: string) => deleteIntegration(workspace, id),
    onSuccess: (_, id) => {
      // Remove the individual MCP from cache
      const itemKey = KEYS.INTEGRATION(workspace, id);
      client.cancelQueries({ queryKey: itemKey });
      client.removeQueries({ queryKey: itemKey });

      // Update the list
      const listKey = KEYS.INTEGRATION(workspace);
      client.cancelQueries({ queryKey: listKey });
      client.setQueryData<Integration[]>(
        listKey,
        (old) => !old ? [] : old.filter((mcp) => mcp.id !== id),
      );
    },
  });

  return remove;
};

/** Hook for crud-like operations on MCPs */
export const useIntegration = (id: string) => {
  const { workspace } = useSDK();

  const data = useSuspenseQuery({
    queryKey: KEYS.INTEGRATION(workspace, id),
    queryFn: ({ signal }) => loadIntegration(workspace, id, signal),
    retry: (failureCount, error) =>
      error instanceof IntegrationNotFoundError ? false : failureCount < 2,
  });

  return data;
};

/** Hook for listing all MCPs */
export const useIntegrations = () => {
  const { workspace } = useSDK();
  const client = useQueryClient();

  const data = useSuspenseQuery({
    queryKey: KEYS.INTEGRATION(workspace),
    queryFn: async ({ signal }) => {
      const { items } = await listIntegrations(workspace, signal);

      for (const item of items) {
        const itemKey = KEYS.INTEGRATION(workspace, item.id);

        client.cancelQueries({ queryKey: itemKey });
        client.setQueryData<Integration>(itemKey, item);
      }

      return items;
    },
  });

  return data;
};

interface IntegrationsResult {
  integrations: Array<Integration & { provider: string }>;
}

export const useMarketplaceIntegrations = () => {
  const agentStub = useAgentStub();

  return useSuspenseQuery<IntegrationsResult>({
    queryKey: ["integrations", "marketplace"],
    queryFn: () =>
      agentStub.callTool("DECO_INTEGRATIONS.DECO_INTEGRATIONS_SEARCH", {
        query: "",
        filters: { installed: false },
        verbose: true,
      }).then((r: { data: IntegrationsResult }) => r.data),
  });
};

export const useInstallFromMarketplace = () => {
  const agentStub = useAgentStub();
  const client = useQueryClient();
  const { workspace } = useSDK();

  const mutation = useMutation({
    mutationFn: async (id: string) => {
      const result: { data: { installationId: string } } = await agentStub
        .callTool("DECO_INTEGRATIONS.DECO_INTEGRATION_INSTALL", { id });

      return loadIntegration(workspace, result.data.installationId);
    },
    onSuccess: (result) => {
      // update item
      const itemKey = KEYS.INTEGRATION(workspace, result.id);
      client.cancelQueries({ queryKey: itemKey });
      client.setQueryData<Integration>(itemKey, result);

      // update list
      const listKey = KEYS.INTEGRATION(workspace);
      client.cancelQueries({ queryKey: listKey });
      client.setQueryData<Integration[]>(
        listKey,
        (old) => !old ? [result] : [result, ...old],
      );
    },
  });

  return mutation;
};

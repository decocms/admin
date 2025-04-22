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
import { useSDK } from "./store.tsx";
import { KEYS } from "./api.ts";

export const useCreateIntegration = () => {
  const client = useQueryClient();
  const { workspace } = useSDK();

  const create = useMutation({
    mutationFn: (mcp: Partial<Integration>) =>
      createIntegration(workspace, mcp),
    onSuccess: (result) => {
      const key = KEYS.INTEGRATION(workspace, result.id);

      // update item
      client.setQueryData(key, result);

      // update list
      client.setQueryData(
        KEYS.INTEGRATION(workspace),
        (old: Integration[] | undefined) => {
          if (!old) return [result];
          return [result, ...old];
        },
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
    onSuccess: (updatedMCP) => {
      // Update the individual MCP in cache
      client.setQueryData(
        KEYS.INTEGRATION(workspace, updatedMCP.id),
        updatedMCP,
      );

      // Update the list
      client.setQueryData(
        KEYS.INTEGRATION(workspace),
        (old: Integration[] | undefined) => {
          if (!old) return [updatedMCP];
          return old.map((mcp) => mcp.id === updatedMCP.id ? updatedMCP : mcp);
        },
      );
    },
  });

  return update;
};

export const useRemoveIntegration = () => {
  const client = useQueryClient();
  const { workspace } = useSDK();

  const remove = useMutation({
    mutationFn: (mcpId: string) => deleteIntegration(workspace, mcpId),
    onSuccess: (_, mcpId) => {
      // Remove the individual MCP from cache
      client.removeQueries({ queryKey: KEYS.INTEGRATION(workspace, mcpId) });

      // Update the list
      client.setQueryData(
        KEYS.INTEGRATION(workspace),
        (old: Integration[]) => {
          if (!old) return old;
          return old.filter((mcp: Integration) => mcp.id !== mcpId);
        },
      );
    },
  });

  return remove;
};

/** Hook for crud-like operations on MCPs */
export const useIntegration = (mcpId: string) => {
  const { workspace } = useSDK();

  const data = useSuspenseQuery({
    queryKey: KEYS.INTEGRATION(workspace, mcpId),
    queryFn: () => loadIntegration(workspace, mcpId),
    retry: (failureCount, error) =>
      error instanceof IntegrationNotFoundError ? false : failureCount < 2,
  });

  return data;
};

/** Hook for listing all MCPs */
export const useIntegrations = () => {
  const { workspace } = useSDK();

  const data = useSuspenseQuery({
    queryKey: KEYS.INTEGRATION(workspace),
    queryFn: () => listIntegrations(workspace).then((r) => r.items),
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
    mutationFn: async (mcpId: string) => {
      const result: { data: { installationId: string } } = await agentStub
        .callTool("DECO_INTEGRATIONS.DECO_INTEGRATION_INSTALL", { id: mcpId });

      return result.data;
    },
    onSuccess: () => {
      // Invalidate the integrations list to refresh it
      client.invalidateQueries({ queryKey: KEYS.INTEGRATION(workspace) });
    },
  });

  return mutation;
};

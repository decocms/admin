import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  createIntegration,
  deleteIntegration,
  listIntegrations,
  loadIntegration,
  saveIntegration,
} from "../crud/mcp.ts";
import { InternalServerError } from "../errors.ts";
import type { Binder, Integration } from "../models/mcp.ts";
import { useAgentStub } from "./agent.ts";
import { KEYS } from "./api.ts";
import { useSDK } from "./store.tsx";
import { listTools, MCPTool } from "./index.ts";
import { Binding, WellKnownBindings } from "@deco/sdk/mcp/bindings";

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
      error instanceof InternalServerError && failureCount < 2,
  });

  return data;
};

/** Hook for listing all bindings */
export const useBindings = (binder: Binder) => {
  const { workspace } = useSDK();
  const client = useQueryClient();

  const data = useQuery({
    queryKey: KEYS.BINDINGS(workspace, binder),
    queryFn: async ({ signal }) => {
      const items = await listIntegrations(workspace, {}, signal);

      // Initialize with empty array to show loading state
      const queryKey = KEYS.BINDINGS(workspace, binder);
      client.setQueryData<Integration[]>(queryKey, []);

      const filtered: typeof items = [];

      // Process items sequentially to provide incremental updates
      for (const item of items) {
        if (signal?.aborted) {
          throw new Error('Query was cancelled');
        }

        try {
          const integrationTools = await Promise.race([
            listTools(item.connection).then((tools) => ({
              ...item,
              tools: tools.tools,
            })).catch((error) => {
              console.error("error", error);
              return {
                ...item,
                tools: [],
              };
            }),
            new Promise<{
              tools: MCPTool[];
            }>((resolve) =>
              setTimeout(() =>
                resolve({
                  tools: [],
                }), 7_000)
            ),
          ]);

          if (
            Binding(WellKnownBindings[binder]).isImplementedBy(
              integrationTools?.tools,
            )
          ) {
            filtered.push(item);
            
            // Update query data incrementally
            client.setQueryData<Integration[]>(queryKey, [...filtered]);
          }

          // Cache individual integration
          const itemKey = KEYS.INTEGRATION(workspace, item.id);
          client.cancelQueries({ queryKey: itemKey });
          client.setQueryData<Integration>(itemKey, item);

        } catch (error) {
          console.error("Error processing integration:", item.id, error);
        }
      }

      return filtered;
    },
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
      const items = await listIntegrations(workspace, {}, signal);

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

const WELL_KNOWN_DECO_OAUTH_INTEGRATIONS = [
  "github",
  "googlesheets",
  "googlegmail",
  "airtable",
  "slack",
];

export const useInstallFromMarketplace = () => {
  const agentStub = useAgentStub();
  const client = useQueryClient();
  const { workspace } = useSDK();

  const mutation = useMutation({
    mutationFn: async (
      { appName, provider, returnUrl }: {
        appName: string;
        returnUrl: string;
        provider: string;
      },
    ) => {
      const result: { data: { installationId: string } } = await agentStub
        .callTool("DECO_INTEGRATIONS.DECO_INTEGRATION_INSTALL", {
          id: appName,
        });

      const integration = await loadIntegration(
        workspace,
        result.data.installationId,
      );

      let redirectUrl: string | null = null;

      if (
        WELL_KNOWN_DECO_OAUTH_INTEGRATIONS.includes(appName.toLowerCase()) &&
        provider === "deco"
      ) {
        const result = await agentStub.callTool(
          "DECO_INTEGRATIONS.DECO_INTEGRATION_OAUTH_START",
          {
            appName: appName,
            returnUrl,
            installId: integration.id.split(":").pop()!,
          },
        );
        redirectUrl = result?.data?.redirectUrl;
        if (!redirectUrl) {
          throw new Error("No redirect URL found");
        }
      }

      return { integration, redirectUrl };
    },
    onSuccess: ({ integration }) => {
      if (!integration) {
        return;
      }

      // update item
      const itemKey = KEYS.INTEGRATION(workspace, integration.id);
      client.cancelQueries({ queryKey: itemKey });
      client.setQueryData<Integration>(itemKey, integration);

      // update list
      const listKey = KEYS.INTEGRATION(workspace);
      client.cancelQueries({ queryKey: listKey });
      client.setQueryData<Integration[]>(
        listKey,
        (old) => !old ? [integration] : [integration, ...old],
      );
    },
  });

  return mutation;
};

import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useEffect } from "react";
import {
  addResourceUpdateListener,
  notifyResourceUpdate,
} from "../broadcast.ts";
import { formatIntegrationId, WellKnownMcpGroups } from "../crud/groups.ts";
import { InternalServerError } from "../errors.ts";
import { MCPClient } from "../fetcher.ts";
import type { ProjectLocator } from "../locator.ts";
import { AgentV2DataSchema } from "../mcp/agents-v2/schemas.ts";
import type { ReadOutput, SearchOutput } from "../mcp/resources-v2/schemas.ts";
import { KEYS, parseIntegrationId } from "./react-query-keys.ts";
import { useSDK } from "./store.tsx";

// Resources V2 tool names for agents
const RESOURCE_AGENT = {
  SEARCH: "DECO_RESOURCE_AGENT_SEARCH" as const,
  READ: "DECO_RESOURCE_AGENT_READ" as const,
  CREATE: "DECO_RESOURCE_AGENT_CREATE" as const,
  UPDATE: "DECO_RESOURCE_AGENT_UPDATE" as const,
  DELETE: "DECO_RESOURCE_AGENT_DELETE" as const,
};

// Helper functions
const workspaceResourceClient = (locator: ProjectLocator) =>
  MCPClient.forLocator(locator, `/mcp`);

const integrationId = formatIntegrationId(WellKnownMcpGroups.AgentsV2);

export function buildAgentUri(id: string): string {
  return `rsc://${integrationId}/agent/${id}`;
}

// CRUD Functions (Resources V2)
export type AgentReadResult = ReadOutput<typeof AgentV2DataSchema>;
export type AgentSearchResult = SearchOutput<typeof AgentV2DataSchema>;

export function getAgentByUri(
  locator: ProjectLocator,
  uri: string,
  signal?: AbortSignal,
): Promise<AgentReadResult> {
  // oxlint-disable-next-line no-explicit-any
  const client = workspaceResourceClient(locator) as any;
  return client[RESOURCE_AGENT.READ](
    { uri },
    { signal },
  ) as Promise<AgentReadResult>;
}

export function searchAgentsV2(
  locator: ProjectLocator,
  params?: {
    term?: string;
    page?: number;
    pageSize?: number;
  },
  signal?: AbortSignal,
): Promise<AgentSearchResult> {
  // oxlint-disable-next-line no-explicit-any
  const client = workspaceResourceClient(locator) as any;
  return client[RESOURCE_AGENT.SEARCH](
    params || {},
    { signal },
  ) as Promise<AgentSearchResult>;
}

export interface AgentCreateParamsV2 {
  name: string;
  description?: string;
  system: string;
  tools?: Record<string, string[]>;
}

export function createAgentV2(
  locator: ProjectLocator,
  params: AgentCreateParamsV2,
  signal?: AbortSignal,
): Promise<AgentReadResult> {
  // oxlint-disable-next-line no-explicit-any
  const client = workspaceResourceClient(locator) as any;
  return client[RESOURCE_AGENT.CREATE](
    {
      data: params,
    },
    { signal },
  ) as Promise<AgentReadResult>;
}

export function updateAgentV2(
  locator: ProjectLocator,
  uri: string,
  params: Partial<AgentCreateParamsV2>,
  signal?: AbortSignal,
): Promise<AgentReadResult> {
  // oxlint-disable-next-line no-explicit-any
  const client = workspaceResourceClient(locator) as any;
  return client[RESOURCE_AGENT.UPDATE](
    {
      uri,
      data: params,
    },
    { signal },
  ) as Promise<AgentReadResult>;
}

export function deleteAgentV2(
  locator: ProjectLocator,
  uri: string,
  signal?: AbortSignal,
): Promise<void> {
  // oxlint-disable-next-line no-explicit-any
  const client = workspaceResourceClient(locator) as any;
  return client[RESOURCE_AGENT.DELETE]({ uri }, { signal }) as Promise<void>;
}

// React Hooks
export function useAgentV2(uri: string) {
  const { locator } = useSDK();
  const queryClient = useQueryClient();

  if (!locator) {
    throw new InternalServerError("No locator available");
  }

  const query = useQuery({
    queryKey: ["agent-v2", locator, uri],
    queryFn: ({ signal }) => getAgentByUri(locator, uri, signal),
    retry: false,
  });

  // Listen for resource updates and auto-invalidate
  useEffect(() => {
    const cleanup = addResourceUpdateListener((message) => {
      if (message.type === "RESOURCE_UPDATED" && message.resourceUri === uri) {
        queryClient.invalidateQueries({
          queryKey: ["agent-v2", locator, uri],
          refetchType: "all",
        });

        queryClient.invalidateQueries({
          queryKey: ["agents-v2-list", locator, integrationId],
          refetchType: "all",
        });
      }
    });

    return cleanup;
  }, [locator, uri, queryClient]);

  return query;
}

export function useAgentsV2(params?: {
  term?: string;
  page?: number;
  pageSize?: number;
}) {
  const { locator } = useSDK();

  if (!locator) {
    throw new InternalServerError("No locator available");
  }

  return useSuspenseQuery({
    queryKey: ["agents-v2-list", locator, integrationId, params],
    queryFn: ({ signal }) => searchAgentsV2(locator, params, signal),
  });
}

export function useCreateAgentV2() {
  const { locator } = useSDK();
  const queryClient = useQueryClient();

  if (!locator) {
    throw new InternalServerError("No locator available");
  }

  return useMutation({
    mutationFn: (params: AgentCreateParamsV2) =>
      createAgentV2(locator, params),
    onSuccess: (data) => {
      // Invalidate agents list
      queryClient.invalidateQueries({
        queryKey: ["agents-v2-list", locator, integrationId],
      });

      // Notify other tabs/windows
      notifyResourceUpdate(data.uri);
    },
  });
}

export function useUpdateAgentV2() {
  const { locator } = useSDK();
  const queryClient = useQueryClient();

  if (!locator) {
    throw new InternalServerError("No locator available");
  }

  return useMutation({
    mutationFn: ({
      uri,
      params,
    }: {
      uri: string;
      params: Partial<AgentCreateParamsV2>;
    }) => updateAgentV2(locator, uri, params),
    onSuccess: (data) => {
      // Invalidate this agent query
      queryClient.invalidateQueries({
        queryKey: ["agent-v2", locator, data.uri],
      });

      // Invalidate agents list
      queryClient.invalidateQueries({
        queryKey: ["agents-v2-list", locator, integrationId],
      });

      // Notify other tabs/windows
      notifyResourceUpdate(data.uri);
    },
  });
}

export function useDeleteAgentV2() {
  const { locator } = useSDK();
  const queryClient = useQueryClient();

  if (!locator) {
    throw new InternalServerError("No locator available");
  }

  return useMutation({
    mutationFn: (uri: string) => deleteAgentV2(locator, uri),
    onSuccess: (_data, uri) => {
      // Invalidate this agent query
      queryClient.invalidateQueries({
        queryKey: ["agent-v2", locator, uri],
      });

      // Invalidate agents list
      queryClient.invalidateQueries({
        queryKey: ["agents-v2-list", locator, integrationId],
      });

      // Notify other tabs/windows
      notifyResourceUpdate(uri);
    },
  });
}


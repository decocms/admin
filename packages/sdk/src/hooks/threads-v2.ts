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
import { ThreadV2DataSchema } from "../mcp/agents-v2/schemas.ts";
import type { ReadOutput, SearchOutput } from "../mcp/resources-v2/schemas.ts";
import { KEYS, parseIntegrationId } from "./react-query-keys.ts";
import { useSDK } from "./store.tsx";

// Resources V2 tool names for threads
const RESOURCE_THREAD = {
  SEARCH: "DECO_RESOURCE_THREAD_SEARCH" as const,
  READ: "DECO_RESOURCE_THREAD_READ" as const,
  CREATE: "DECO_RESOURCE_THREAD_CREATE" as const,
  UPDATE: "DECO_RESOURCE_THREAD_UPDATE" as const,
  DELETE: "DECO_RESOURCE_THREAD_DELETE" as const,
};

// Helper functions
const workspaceResourceClient = (locator: ProjectLocator) =>
  MCPClient.forLocator(locator, `/mcp`);

const integrationId = formatIntegrationId(WellKnownMcpGroups.AgentsV2);

export function buildThreadUri(id: string): string {
  return `rsc://${integrationId}/thread/${id}`;
}

// CRUD Functions (Resources V2)
export type ThreadReadResult = ReadOutput<typeof ThreadV2DataSchema>;
export type ThreadSearchResult = SearchOutput<typeof ThreadV2DataSchema>;

export function getThreadByUri(
  locator: ProjectLocator,
  uri: string,
  signal?: AbortSignal,
): Promise<ThreadReadResult> {
  // oxlint-disable-next-line no-explicit-any
  const client = workspaceResourceClient(locator) as any;
  return client[RESOURCE_THREAD.READ](
    { uri },
    { signal },
  ) as Promise<ThreadReadResult>;
}

export function searchThreadsV2(
  locator: ProjectLocator,
  params?: {
    term?: string;
    page?: number;
    pageSize?: number;
  },
  signal?: AbortSignal,
): Promise<ThreadSearchResult> {
  // oxlint-disable-next-line no-explicit-any
  const client = workspaceResourceClient(locator) as any;
  return client[RESOURCE_THREAD.SEARCH](
    params || {},
    { signal },
  ) as Promise<ThreadSearchResult>;
}

export interface ThreadCreateParamsV2 {
  name: string;
  description?: string;
  agentId?: string;
  messages?: any[]; // UIMessage[]
}

export function createThreadV2(
  locator: ProjectLocator,
  params: ThreadCreateParamsV2,
  signal?: AbortSignal,
): Promise<ThreadReadResult> {
  // oxlint-disable-next-line no-explicit-any
  const client = workspaceResourceClient(locator) as any;
  return client[RESOURCE_THREAD.CREATE](
    {
      data: params,
    },
    { signal },
  ) as Promise<ThreadReadResult>;
}

export function updateThreadV2(
  locator: ProjectLocator,
  uri: string,
  params: Partial<ThreadCreateParamsV2>,
  signal?: AbortSignal,
): Promise<ThreadReadResult> {
  // oxlint-disable-next-line no-explicit-any
  const client = workspaceResourceClient(locator) as any;
  return client[RESOURCE_THREAD.UPDATE](
    {
      uri,
      data: params,
    },
    { signal },
  ) as Promise<ThreadReadResult>;
}

export function deleteThreadV2(
  locator: ProjectLocator,
  uri: string,
  signal?: AbortSignal,
): Promise<void> {
  // oxlint-disable-next-line no-explicit-any
  const client = workspaceResourceClient(locator) as any;
  return client[RESOURCE_THREAD.DELETE]({ uri }, { signal }) as Promise<void>;
}

// Append message helper
export function appendThreadMessageV2(
  locator: ProjectLocator,
  threadUri: string,
  message: any, // UIMessage
  signal?: AbortSignal,
): Promise<{ success: boolean; threadUri: string; messageCount: number }> {
  // oxlint-disable-next-line no-explicit-any
  const client = workspaceResourceClient(locator) as any;
  return client.DECO_THREADS_V2_APPEND_MESSAGE(
    {
      threadUri,
      message,
    },
    { signal },
  ) as Promise<{ success: boolean; threadUri: string; messageCount: number }>;
}

// React Hooks
export function useThreadV2(uri: string) {
  const { locator } = useSDK();
  const queryClient = useQueryClient();

  if (!locator) {
    throw new InternalServerError("No locator available");
  }

  const query = useQuery({
    queryKey: ["thread-v2", locator, uri],
    queryFn: ({ signal }) => getThreadByUri(locator, uri, signal),
    retry: false,
  });

  // Listen for resource updates and auto-invalidate
  useEffect(() => {
    const cleanup = addResourceUpdateListener((message) => {
      if (message.type === "RESOURCE_UPDATED" && message.resourceUri === uri) {
        queryClient.invalidateQueries({
          queryKey: ["thread-v2", locator, uri],
          refetchType: "all",
        });

        queryClient.invalidateQueries({
          queryKey: ["threads-v2-list", locator, integrationId],
          refetchType: "all",
        });
      }
    });

    return cleanup;
  }, [locator, uri, queryClient]);

  return query;
}

export function useThreadsV2(params?: {
  term?: string;
  page?: number;
  pageSize?: number;
}) {
  const { locator } = useSDK();

  if (!locator) {
    throw new InternalServerError("No locator available");
  }

  return useSuspenseQuery({
    queryKey: ["threads-v2-list", locator, integrationId, params],
    queryFn: ({ signal }) => searchThreadsV2(locator, params, signal),
  });
}

export function useThreadMessagesV2(uri: string) {
  const threadQuery = useThreadV2(uri);

  return {
    ...threadQuery,
    messages: threadQuery.data?.data.messages || [],
  };
}

export function useCreateThreadV2() {
  const { locator } = useSDK();
  const queryClient = useQueryClient();

  if (!locator) {
    throw new InternalServerError("No locator available");
  }

  return useMutation({
    mutationFn: (params: ThreadCreateParamsV2) =>
      createThreadV2(locator, params),
    onSuccess: (data) => {
      // Invalidate threads list
      queryClient.invalidateQueries({
        queryKey: ["threads-v2-list", locator, integrationId],
      });

      // Notify other tabs/windows
      notifyResourceUpdate(data.uri);
    },
  });
}

export function useUpdateThreadV2() {
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
      params: Partial<ThreadCreateParamsV2>;
    }) => updateThreadV2(locator, uri, params),
    onSuccess: (data) => {
      // Invalidate this thread query
      queryClient.invalidateQueries({
        queryKey: ["thread-v2", locator, data.uri],
      });

      // Invalidate threads list
      queryClient.invalidateQueries({
        queryKey: ["threads-v2-list", locator, integrationId],
      });

      // Notify other tabs/windows
      notifyResourceUpdate(data.uri);
    },
  });
}

export function useAppendThreadMessageV2() {
  const { locator } = useSDK();
  const queryClient = useQueryClient();

  if (!locator) {
    throw new InternalServerError("No locator available");
  }

  return useMutation({
    mutationFn: ({
      threadUri,
      message,
    }: {
      threadUri: string;
      message: any;
    }) => appendThreadMessageV2(locator, threadUri, message),
    onSuccess: (_data, { threadUri }) => {
      // Invalidate this thread query
      queryClient.invalidateQueries({
        queryKey: ["thread-v2", locator, threadUri],
      });

      // Notify other tabs/windows
      notifyResourceUpdate(threadUri);
    },
  });
}

export function useDeleteThreadV2() {
  const { locator } = useSDK();
  const queryClient = useQueryClient();

  if (!locator) {
    throw new InternalServerError("No locator available");
  }

  return useMutation({
    mutationFn: (uri: string) => deleteThreadV2(locator, uri),
    onSuccess: (_data, uri) => {
      // Invalidate this thread query
      queryClient.invalidateQueries({
        queryKey: ["thread-v2", locator, uri],
      });

      // Invalidate threads list
      queryClient.invalidateQueries({
        queryKey: ["threads-v2-list", locator, integrationId],
      });

      // Notify other tabs/windows
      notifyResourceUpdate(uri);
    },
  });
}


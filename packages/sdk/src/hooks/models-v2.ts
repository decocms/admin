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
import { ModelV2DataSchema } from "../mcp/agents-v2/schemas.ts";
import type { ReadOutput, SearchOutput } from "../mcp/resources-v2/schemas.ts";
import { KEYS, parseIntegrationId } from "./react-query-keys.ts";
import { useSDK } from "./store.tsx";

// Resources V2 tool names for models
const RESOURCE_MODEL = {
  SEARCH: "DECO_RESOURCE_MODEL_SEARCH" as const,
  READ: "DECO_RESOURCE_MODEL_READ" as const,
  CREATE: "DECO_RESOURCE_MODEL_CREATE" as const,
  UPDATE: "DECO_RESOURCE_MODEL_UPDATE" as const,
  DELETE: "DECO_RESOURCE_MODEL_DELETE" as const,
};

// Helper functions
const workspaceResourceClient = (locator: ProjectLocator) =>
  MCPClient.forLocator(locator, `/mcp`);

const integrationId = formatIntegrationId(WellKnownMcpGroups.AgentsV2);

export function buildModelUri(id: string): string {
  return `rsc://${integrationId}/model/${id}`;
}

// CRUD Functions (Resources V2)
export type ModelReadResult = ReadOutput<typeof ModelV2DataSchema>;
export type ModelSearchResult = SearchOutput<typeof ModelV2DataSchema>;

export function getModelByUri(
  locator: ProjectLocator,
  uri: string,
  signal?: AbortSignal,
): Promise<ModelReadResult> {
  // oxlint-disable-next-line no-explicit-any
  const client = workspaceResourceClient(locator) as any;
  return client[RESOURCE_MODEL.READ](
    { uri },
    { signal },
  ) as Promise<ModelReadResult>;
}

export function searchModelsV2(
  locator: ProjectLocator,
  params?: {
    term?: string;
    page?: number;
    pageSize?: number;
  },
  signal?: AbortSignal,
): Promise<ModelSearchResult> {
  // oxlint-disable-next-line no-explicit-any
  const client = workspaceResourceClient(locator) as any;
  return client[RESOURCE_MODEL.SEARCH](
    params || {},
    { signal },
  ) as Promise<ModelSearchResult>;
}

export interface ModelCreateParamsV2 {
  name: string;
  description?: string;
  provider: string;
  modelId: string;
  supports?: string[];
  limits?: Array<{ name: string; value: string }>;
  price?: {
    input: number;
    output: number;
  };
}

export function createModelV2(
  locator: ProjectLocator,
  params: ModelCreateParamsV2,
  signal?: AbortSignal,
): Promise<ModelReadResult> {
  // oxlint-disable-next-line no-explicit-any
  const client = workspaceResourceClient(locator) as any;
  return client[RESOURCE_MODEL.CREATE](
    {
      data: params,
    },
    { signal },
  ) as Promise<ModelReadResult>;
}

export function updateModelV2(
  locator: ProjectLocator,
  uri: string,
  params: Partial<ModelCreateParamsV2>,
  signal?: AbortSignal,
): Promise<ModelReadResult> {
  // oxlint-disable-next-line no-explicit-any
  const client = workspaceResourceClient(locator) as any;
  return client[RESOURCE_MODEL.UPDATE](
    {
      uri,
      data: params,
    },
    { signal },
  ) as Promise<ModelReadResult>;
}

export function deleteModelV2(
  locator: ProjectLocator,
  uri: string,
  signal?: AbortSignal,
): Promise<void> {
  // oxlint-disable-next-line no-explicit-any
  const client = workspaceResourceClient(locator) as any;
  return client[RESOURCE_MODEL.DELETE]({ uri }, { signal }) as Promise<void>;
}

// Model generation/streaming helpers
export function getModelStreamUrl(
  locator: ProjectLocator,
  modelUri: string,
): Promise<{ streamUrl: string }> {
  // oxlint-disable-next-line no-explicit-any
  const client = workspaceResourceClient(locator) as any;
  return client.DECO_MODELS_V2_STREAM_TEXT({
    modelUri,
  }) as Promise<{ streamUrl: string }>;
}

// React Hooks
export function useModelV2(uri: string) {
  const { locator } = useSDK();
  const queryClient = useQueryClient();

  if (!locator) {
    throw new InternalServerError("No locator available");
  }

  const query = useQuery({
    queryKey: ["model-v2", locator, uri],
    queryFn: ({ signal }) => getModelByUri(locator, uri, signal),
    retry: false,
  });

  // Listen for resource updates and auto-invalidate
  useEffect(() => {
    const cleanup = addResourceUpdateListener((message) => {
      if (message.type === "RESOURCE_UPDATED" && message.resourceUri === uri) {
        queryClient.invalidateQueries({
          queryKey: ["model-v2", locator, uri],
          refetchType: "all",
        });

        queryClient.invalidateQueries({
          queryKey: ["models-v2-list", locator, integrationId],
          refetchType: "all",
        });
      }
    });

    return cleanup;
  }, [locator, uri, queryClient]);

  return query;
}

export function useModelsV2(params?: {
  term?: string;
  page?: number;
  pageSize?: number;
}) {
  const { locator } = useSDK();

  if (!locator) {
    throw new InternalServerError("No locator available");
  }

  return useSuspenseQuery({
    queryKey: ["models-v2-list", locator, integrationId, params],
    queryFn: ({ signal }) => searchModelsV2(locator, params, signal),
  });
}

export function useCreateModelV2() {
  const { locator } = useSDK();
  const queryClient = useQueryClient();

  if (!locator) {
    throw new InternalServerError("No locator available");
  }

  return useMutation({
    mutationFn: (params: ModelCreateParamsV2) =>
      createModelV2(locator, params),
    onSuccess: (data) => {
      // Invalidate models list
      queryClient.invalidateQueries({
        queryKey: ["models-v2-list", locator, integrationId],
      });

      // Notify other tabs/windows
      notifyResourceUpdate(data.uri);
    },
  });
}

export function useUpdateModelV2() {
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
      params: Partial<ModelCreateParamsV2>;
    }) => updateModelV2(locator, uri, params),
    onSuccess: (data) => {
      // Invalidate this model query
      queryClient.invalidateQueries({
        queryKey: ["model-v2", locator, data.uri],
      });

      // Invalidate models list
      queryClient.invalidateQueries({
        queryKey: ["models-v2-list", locator, integrationId],
      });

      // Notify other tabs/windows
      notifyResourceUpdate(data.uri);
    },
  });
}

export function useDeleteModelV2() {
  const { locator } = useSDK();
  const queryClient = useQueryClient();

  if (!locator) {
    throw new InternalServerError("No locator available");
  }

  return useMutation({
    mutationFn: (uri: string) => deleteModelV2(locator, uri),
    onSuccess: (_data, uri) => {
      // Invalidate this model query
      queryClient.invalidateQueries({
        queryKey: ["model-v2", locator, uri],
      });

      // Invalidate models list
      queryClient.invalidateQueries({
        queryKey: ["models-v2-list", locator, integrationId],
      });

      // Notify other tabs/windows
      notifyResourceUpdate(uri);
    },
  });
}


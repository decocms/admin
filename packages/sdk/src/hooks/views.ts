import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  addResourceUpdateListener,
  notifyResourceUpdate,
} from "../broadcast.ts";
import { WellKnownMcpGroups, formatIntegrationId } from "../crud/groups.ts";
import { InternalServerError } from "../errors.ts";
import { MCPClient } from "../fetcher.ts";
import type { ProjectLocator } from "../locator.ts";
import type { ReadOutput } from "../mcp/resources-v2/schemas.ts";
import { ViewDefinitionSchema } from "../mcp/views/schemas.ts";
import {
  parseIntegrationId,
  resourceKeys,
  resourceListKeys,
} from "./query-keys.ts";
import { useSDK } from "./store.tsx";

// Resources V2 view names for views
const RESOURCE_VIEW = {
  SEARCH: "DECO_RESOURCE_VIEW_SEARCH" as const,
  READ: "DECO_RESOURCE_VIEW_READ" as const,
  CREATE: "DECO_RESOURCE_VIEW_CREATE" as const,
  UPDATE: "DECO_RESOURCE_VIEW_UPDATE" as const,
  DELETE: "DECO_RESOURCE_VIEW_DELETE" as const,
};

// Helper functions
const workspaceResourceClient = (locator: ProjectLocator) =>
  MCPClient.forLocator(locator, `/mcp`);

const integrationId = formatIntegrationId(WellKnownMcpGroups.Views);

export function buildViewUri(name: string): string {
  // rsc://i:views-management/view/<id>
  return `rsc://${integrationId}/view/${encodeURIComponent(name)}`;
}

// CRUD Functions (Resources V2)
export type ViewReadResult = ReadOutput<typeof ViewDefinitionSchema>;

export function getViewByUri(
  locator: ProjectLocator,
  uri: string,
  signal?: AbortSignal,
): Promise<ViewReadResult> {
  // deno-lint-ignore no-explicit-any
  const client = workspaceResourceClient(locator) as any;
  return client[RESOURCE_VIEW.READ](
    { uri },
    { signal },
  ) as Promise<ViewReadResult>;
}

export interface ViewUpsertParamsV2 {
  name: string;
  description?: string;
  html: string;
  icon?: string;
  tags?: string[];
}

export function updateViewV2(
  locator: ProjectLocator,
  uri: string,
  params: Partial<ViewUpsertParamsV2>,
  signal?: AbortSignal,
): Promise<ViewReadResult> {
  // deno-lint-ignore no-explicit-any
  const client = workspaceResourceClient(locator) as any;
  return client[RESOURCE_VIEW.UPDATE](
    {
      uri,
      data: params,
    },
    { signal },
  ) as Promise<ViewReadResult>;
}

export function deleteViewV2(
  locator: ProjectLocator,
  uri: string,
  signal?: AbortSignal,
): Promise<void> {
  // deno-lint-ignore no-explicit-any
  const client = workspaceResourceClient(locator) as any;
  return client[RESOURCE_VIEW.DELETE]({ uri }, { signal }) as Promise<void>;
}

// React Hooks
export function useViewByUriV2(uri: string) {
  const { locator } = useSDK();
  const queryClient = useQueryClient();

  if (!locator) {
    throw new InternalServerError("No locator available");
  }

  const query = useQuery({
    queryKey: resourceKeys.view(locator, uri),
    queryFn: ({ signal }) => getViewByUri(locator, uri, signal),
    retry: false,
  });

  // Listen for resource updates and auto-invalidate
  useEffect(() => {
    const cleanup = addResourceUpdateListener((message) => {
      if (message.type === "RESOURCE_UPDATED" && message.resourceUri === uri) {
        // Invalidate this specific view query
        queryClient.invalidateQueries({
          queryKey: resourceKeys.view(locator, uri),
          refetchType: "all",
        });

        // Also invalidate the view list
        const parsedIntegrationId = parseIntegrationId(uri);
        queryClient.invalidateQueries({
          queryKey: resourceListKeys.views(locator, parsedIntegrationId),
          refetchType: "all",
        });
      }
    });

    return cleanup;
  }, [uri, locator, queryClient]);

  return query;
}

export function useUpdateView() {
  const { locator } = useSDK();
  if (!locator) {
    throw new InternalServerError("No locator available");
  }

  return useMutation({
    mutationFn: ({
      uri,
      params,
      signal,
    }: {
      uri: string;
      params: Partial<ViewUpsertParamsV2>;
      signal?: AbortSignal;
    }) => updateViewV2(locator, uri, params, signal),
    onSuccess: (_data, variables) => {
      // Notify about the resource update
      notifyResourceUpdate(variables.uri);
    },
  });
}

export function useDeleteView() {
  const { locator } = useSDK();
  if (!locator) {
    throw new InternalServerError("No locator available");
  }

  return useMutation({
    mutationFn: ({ uri, signal }: { uri: string; signal?: AbortSignal }) =>
      deleteViewV2(locator, uri, signal),
    onSuccess: (_data, variables) => {
      // Notify about the resource deletion
      notifyResourceUpdate(variables.uri);
    },
  });
}

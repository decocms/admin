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
import { WellKnownMcpGroups, formatIntegrationId } from "../crud/groups.ts";
import { InternalServerError } from "../errors.ts";
import { MCPClient } from "../fetcher.ts";
import type { ProjectLocator } from "../locator.ts";
import { DocumentDefinitionSchema } from "../mcp/documents/schemas.ts";
import type { ReadOutput } from "../mcp/resources-v2/schemas.ts";
import {
  documentSearchKeys,
  parseIntegrationId,
  resourceKeys,
  resourceListKeys,
} from "./query-keys.ts";
import { useSDK } from "./store.tsx";

// Resources V2 document names for documents
const RESOURCE_DOCUMENT = {
  SEARCH: "DECO_RESOURCE_DOCUMENT_SEARCH" as const,
  READ: "DECO_RESOURCE_DOCUMENT_READ" as const,
  CREATE: "DECO_RESOURCE_DOCUMENT_CREATE" as const,
  UPDATE: "DECO_RESOURCE_DOCUMENT_UPDATE" as const,
  DELETE: "DECO_RESOURCE_DOCUMENT_DELETE" as const,
};

// Helper functions
const workspaceResourceClient = (locator: ProjectLocator) =>
  MCPClient.forLocator(locator, `/mcp`);

const integrationId = formatIntegrationId(WellKnownMcpGroups.Documents);

export function buildDocumentUri(name: string): string {
  // rsc://i:documents-management/document/<id>
  return `rsc://${integrationId}/document/${name}`;
}

// CRUD Functions (Resources V2)
export type DocumentReadResult = ReadOutput<typeof DocumentDefinitionSchema>;

export function getDocumentByName(
  locator: ProjectLocator,
  name: string,
  signal?: AbortSignal,
): Promise<DocumentReadResult> {
  // Deprecated: prefer getDocumentByUri with rsc:// URI
  return getDocumentByUri(locator, buildDocumentUri(name), signal);
}

export function getDocumentByUri(
  locator: ProjectLocator,
  uri: string,
  signal?: AbortSignal,
): Promise<DocumentReadResult> {
  // oxlint-disable-next-line no-explicit-any
  const client = workspaceResourceClient(locator) as any;
  return client[RESOURCE_DOCUMENT.READ](
    { uri },
    { signal },
  ) as Promise<DocumentReadResult>;
}

export interface DocumentUpsertParamsV2 {
  name: string;
  description?: string;
  content: string;
  tags?: string[];
}

export function upsertDocumentV2(
  locator: ProjectLocator,
  params: DocumentUpsertParamsV2,
  signal?: AbortSignal,
): Promise<DocumentReadResult> {
  // oxlint-disable-next-line no-explicit-any
  const client = workspaceResourceClient(locator) as any;
  return client[RESOURCE_DOCUMENT.CREATE](
    {
      data: params,
    },
    { signal },
  ) as Promise<DocumentReadResult>;
}

export function updateDocumentV2(
  locator: ProjectLocator,
  uri: string,
  params: Partial<DocumentUpsertParamsV2>,
  signal?: AbortSignal,
): Promise<DocumentReadResult> {
  // oxlint-disable-next-line no-explicit-any
  const client = workspaceResourceClient(locator) as any;
  return client[RESOURCE_DOCUMENT.UPDATE](
    {
      uri,
      data: params,
    },
    { signal },
  ) as Promise<DocumentReadResult>;
}

export function deleteDocumentV2(
  locator: ProjectLocator,
  uri: string,
  signal?: AbortSignal,
): Promise<void> {
  // oxlint-disable-next-line no-explicit-any
  const client = workspaceResourceClient(locator) as any;
  return client[RESOURCE_DOCUMENT.DELETE]({ uri }, { signal }) as Promise<void>;
}

// React Hooks
export function useDocumentByUriV2(uri: string) {
  const { locator } = useSDK();
  const queryClient = useQueryClient();

  if (!locator) {
    throw new InternalServerError("No locator available");
  }

  const query = useQuery({
    queryKey: resourceKeys.document(locator, uri),
    queryFn: ({ signal }) => getDocumentByUri(locator, uri, signal),
    retry: false,
  });

  // Listen for resource updates and auto-invalidate
  useEffect(() => {
    const cleanup = addResourceUpdateListener((message) => {
      if (message.type === "RESOURCE_UPDATED" && message.resourceUri === uri) {
        // Invalidate this specific document query
        queryClient.invalidateQueries({
          queryKey: resourceKeys.document(locator, uri),
          refetchType: "all",
        });

        // Also invalidate the document list
        const integrationId = parseIntegrationId(uri);
        queryClient.invalidateQueries({
          queryKey: resourceListKeys.documents(locator, integrationId),
          refetchType: "all",
        });
      }
    });

    return cleanup;
  }, [locator, uri, queryClient]);

  return query;
}

export function useDocumentSuspense(uri: string) {
  const { locator } = useSDK();
  const queryClient = useQueryClient();

  if (!locator) {
    throw new InternalServerError("No locator available");
  }

  const query = useSuspenseQuery({
    queryKey: resourceKeys.document(locator, uri),
    queryFn: ({ signal }) => getDocumentByUri(locator, uri, signal),
    retry: false,
  });

  // Listen for resource updates and auto-invalidate
  useEffect(() => {
    const cleanup = addResourceUpdateListener((message) => {
      if (message.type === "RESOURCE_UPDATED" && message.resourceUri === uri) {
        // Invalidate this specific document query
        queryClient.invalidateQueries({
          queryKey: resourceKeys.document(locator, uri),
          refetchType: "all",
        });

        // Also invalidate the document list
        const integrationId = parseIntegrationId(uri);
        queryClient.invalidateQueries({
          queryKey: resourceListKeys.documents(locator, integrationId),
          refetchType: "all",
        });
      }
    });

    return cleanup;
  }, [locator, uri, queryClient]);

  return query;
}

export function useUpsertDocument() {
  const { locator } = useSDK();
  if (!locator) {
    throw new InternalServerError("No locator available");
  }

  return useMutation({
    mutationFn: ({
      params,
      signal,
    }: {
      params: DocumentUpsertParamsV2;
      signal?: AbortSignal;
    }) => upsertDocumentV2(locator, params, signal),
    onSuccess: (data) => {
      // Notify about the resource update
      if (data.uri) {
        notifyResourceUpdate(data.uri);
      }
    },
  });
}

export function useUpdateDocument() {
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
      params: Partial<DocumentUpsertParamsV2>;
      signal?: AbortSignal;
    }) => updateDocumentV2(locator, uri, params, signal),
    onSuccess: (_data, variables) => {
      // Notify about the resource update
      notifyResourceUpdate(variables.uri);
    },
  });
}

export function useDeleteDocument() {
  const { locator } = useSDK();
  if (!locator) {
    throw new InternalServerError("No locator available");
  }

  return useMutation({
    mutationFn: ({ uri, signal }: { uri: string; signal?: AbortSignal }) =>
      deleteDocumentV2(locator, uri, signal),
    onSuccess: (_data, variables) => {
      // Notify about the resource deletion
      notifyResourceUpdate(variables.uri);
    },
  });
}

// Document List Item type for Resources V2
export interface DocumentListItem {
  uri: string;
  data?: {
    name: string;
    description?: string;
    content?: string;
    tags?: string[];
  };
}

// Hook to list documents using Resources V2
export function useDocuments(input?: {
  term?: string;
  page?: number;
  pageSize?: number;
}) {
  const { locator } = useSDK();
  if (!locator) {
    throw new InternalServerError("No locator available");
  }

  return useQuery({
    queryKey: documentSearchKeys.search(
      locator,
      input?.term,
      input?.page,
      input?.pageSize,
    ),
    queryFn: async ({ signal }) => {
      try {
        // oxlint-disable-next-line no-explicit-any
        const client = workspaceResourceClient(locator) as any;
        const result = (await client[RESOURCE_DOCUMENT.SEARCH](
          {
            term: input?.term || "",
            page: input?.page || 1,
            pageSize: input?.pageSize || 100,
          },
          { signal },
        )) as {
          items?: DocumentListItem[];
        };

        return result?.items ?? [];
      } catch (error) {
        console.error("Failed to fetch documents:", error);
        return [];
      }
    },
    staleTime: 30000, // Cache for 30 seconds
    retry: false,
  });
}

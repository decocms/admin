import { callToolFor } from "../fetcher.ts";

export interface Options {
  agentId?: string;
  orderBy?:
    | "createdAt_desc"
    | "createdAt_asc"
    | "updatedAt_desc"
    | "updatedAt_asc";
  cursor?: string;
  limit?: number;
}

export interface ThreadList {
  threads: Thread[];
  pagination: Pagination;
}

export interface Pagination {
  hasMore: boolean;
  nextCursor: string;
}

export interface Thread {
  id: string;
  resourceId: string;
  title: string;
  metadata: Metadata;
  createdAt: string;
  updatedAt: string;
}

export interface Metadata {
  agentId: string;
}

export const listAuditEvents = async (
  workspace: string,
  options: Options,
  init: RequestInit = {},
): Promise<ThreadList> => {
  const response = await callToolFor(
    workspace,
    "THREADS_LIST",
    { ...options },
    init,
  );

  if (!response.ok) {
    const reason = await response.text();
    throw new Error(reason ?? "Failed to list threads");
  }

  const { error, data } = await response.json();

  if (error) {
    throw new Error(error);
  }

  return data as ThreadList;
};

import { callToolFor } from "../fetcher.ts";

export interface Options {
  agentId?: string;
  resourceId?: string;
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

export const listThreads = async (
  workspace: string,
  options: Options,
  init?: RequestInit,
) => {
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

  const { error, data } = await response.json() as {
    error: string;
    data: ThreadList;
  };

  if (error) {
    throw new Error(error);
  }

  return data as ThreadList;
};

export interface ThreadDetails {
  id: string;
  title: string;
  resourceId: string;
  createdAt: string;
  updatedAt: string;
  metadata?: { agentId?: string; tools_set?: Record<string, string[]> };
}

export async function getThread(
  workspace: string,
  threadId: string,
  init: RequestInit = {},
): Promise<ThreadDetails> {
  const response = await callToolFor(
    workspace,
    "THREADS_GET",
    { id: threadId },
    init,
  );

  if (!response.ok) {
    throw new Error(
      await response.text() ?? "Failed to get thread",
    );
  }

  const { error, data } = await response.json() as {
    error: string;
    data: ThreadDetails;
  };

  if (error) {
    throw new Error(error);
  }

  return data as ThreadDetails;
}

export interface ThreadMessage {
  id: string;
  thread_id: string;
  content: string;
  role: "data" | "system" | "user" | "assistant";
  type: string;
  createdAt: Date;
}

export async function getThreadMessages(
  workspace: string,
  threadId: string,
  init: RequestInit = {},
): Promise<ThreadMessage[]> {
  const response = await callToolFor(
    workspace,
    "THREADS_GET_MESSAGES",
    { id: threadId },
    init,
  );

  if (!response.ok) {
    throw new Error(
      await response.text() ?? "Failed to get thread messages",
    );
  }

  const { error, data } = await response.json() as {
    error: string;
    data: ThreadMessage[];
  };

  if (error) {
    throw new Error(error);
  }

  return data as ThreadMessage[];
}

export interface ThreadTools {
  tools_set: Record<string, string[]>;
}

export async function getThreadTools(
  workspace: string,
  threadId: string,
  init: RequestInit = {},
): Promise<ThreadTools> {
  const response = await callToolFor(
    workspace,
    "THREADS_GET_TOOLS",
    { id: threadId },
    init,
  );

  if (!response.ok) {
    throw new Error(
      await response.text() ?? "Failed to get thread tools",
    );
  }

  const { error, data } = await response.json() as {
    error: string;
    data: ThreadTools;
  };

  if (error) {
    throw new Error(error);
  }

  return data;
}

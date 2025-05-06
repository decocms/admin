import { type Message } from "ai";
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

  const { error, data } = await response.json();

  if (error) {
    throw new Error(error);
  }

  return data as ThreadList;
};
interface ThreadWithMessages {
  id: string;
  title: string;
  resourceId: string;
  createdAt: string;
  updatedAt: string;
  metadata?: { agentId?: string };
  messages: Message[];
}

export const getThreadWithMessages = async (
  workspace: string,
  threadId: string,
  init: RequestInit = {},
): Promise<ThreadWithMessages> => {
  const response = await callToolFor(
    workspace,
    "THREADS_GET_WITH_MESSAGES",
    { id: threadId },
    init,
  );

  if (!response.ok) {
    const reason = await response.text();
    throw new Error(reason ?? "Failed to get thread with messages");
  }

  const { error, data } = await response.json();

  if (error) {
    throw new Error(error);
  }

  return data as ThreadWithMessages;
};

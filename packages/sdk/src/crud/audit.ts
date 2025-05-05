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

export interface ThreadWithMessages {
  id: string;
  resourceId: string;
  title: string;
  metadata: Metadata;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

export interface Message {
  id: string;
  thread_id: string;
  content: MessageContent[];
  role: string;
  type: string;
  createdAt: string;
}

export interface MessageContent {
  type: string;
  text?: string;
  toolCallId?: string;
  toolName?: string;
  args?: Args;
  result?: Result;
}

export interface Args {
  ranges?: string[];
  spreadsheet_id?: string;
  first_cell_location?: string;
  sheet_name?: string;
  values?: Array<string[]>;
}

export interface Result {
  success: boolean;
  message: string;
  data: Data;
}

export interface Data {
  content: DataContent[];
}

export interface DataContent {
  type: string;
  text: string;
}

export interface Metadata {
  agentId: string;
}

export const getThreadWithMessages = async (
  workspace: string,
  threadId: string,
  init: RequestInit = {},
): Promise<ThreadWithMessages> => {
  const response = await callToolFor(workspace, "THREADS_GET_WITH_MESSAGES", {
    id: threadId,
  }, init);

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

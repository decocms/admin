import { type Message } from "ai";
import { callToolFor, fetchAPI } from "../fetcher.ts";

export const listThreads = async (workspace: string, signal?: AbortSignal) => {
  const response = await fetchAPI({
    segments: [workspace, "threads"],
    signal,
  });

  if (response.ok) {
    return response.json();
  }

  throw new Error("Failed to list threads");
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

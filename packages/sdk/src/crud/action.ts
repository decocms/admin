import { API_HEADERS, API_SERVER_URL } from "../constants.ts";

export interface Action {
  id: string;
  title: string;
  type: string;
  cronExp?: string;
  description?: string;
  threadId?: string;
  resourceId?: string;
  cronExpFormatted?: string;
  schema?: JSON;
  url?: string;
  prompt?: string;
  passphrase?: string;
  createdAt?: string;
  author?: {
    id: string;
    name: string;
    avatar: string;
  };
}

export interface ListActionsResult {
  success: boolean;
  message: string;
  actions?: Action[];
}

export interface Run {
  id: string;
  result: Record<string, unknown>;
  metadata: Record<string, unknown>;
  timestamp: string;
  status: string;
}

export interface ListRunsResult {
  success: boolean;
  message: string;
  runs?: Run[];
}

const toPath = (segments: string[]) => segments.join("/");

const fetchAPI = (path: string, init?: RequestInit) =>
  fetch(new URL(path, API_SERVER_URL), {
    ...init,
    credentials: "include",
    headers: { ...API_HEADERS, ...init?.headers },
  });

export const listActions = async (context: string, agentId: string) => {
  const response = await fetchAPI(
    toPath([context, "agent", agentId, "actions"]),
  );

  if (response.ok) {
    return response.json() as Promise<ListActionsResult>;
  }

  throw new Error("Failed to list actions");
};

export const listRuns = async (
  context: string,
  agentId: string,
  actionId: string,
) => {
  const response = await fetchAPI(
    toPath([context, "agent", agentId, "action", actionId, "runs"]),
  );

  if (response.ok) {
    return response.json() as Promise<ListRunsResult>;
  }

  throw new Error("Failed to list runs");
};

import { API_HEADERS, API_SERVER_URL } from "../constants.ts";

interface Action {
  title: string;
  type: string;
  cronExp?: string;
  message?: string;
  threadId?: string;
  resourceId?: string;
  cronExpFormatted?: string;
  schema?: unknown;
  passphrase?: string;
}

interface ListActionsResult {
  success: boolean;
  message: string;
  actions?: Action[];
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

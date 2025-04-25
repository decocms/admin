import { API_HEADERS, API_SERVER_URL } from "../constants.ts";

const toPath = (segments: string[]) => segments.join("/");

const fetchAPI = (segments: string[], init?: RequestInit) =>
  fetch(new URL(toPath(segments), API_SERVER_URL), {
    ...init,
    credentials: "include",
    headers: { ...API_HEADERS, ...init?.headers },
  });

export const listThreads = async (context: string, signal?: AbortSignal) => {
  const response = await fetchAPI([context, "threads"], { signal });

  if (response.ok) {
    return response.json();
  }

  throw new Error("Failed to list threads");
};

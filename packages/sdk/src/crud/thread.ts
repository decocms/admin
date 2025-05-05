import { fetchAPI } from "../fetcher.ts";

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

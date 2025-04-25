import { fetchAPI } from "../fetcher.ts";

export const listThreads = async (context: string, signal?: AbortSignal) => {
  const response = await fetchAPI({
    segments: [context, "threads"],
    signal,
  });

  if (response.ok) {
    return response.json();
  }

  throw new Error("Failed to list threads");
};

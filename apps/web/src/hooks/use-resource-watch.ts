import { useQuery } from "@tanstack/react-query";
import { useSDK } from "@deco/sdk";
import { useMemo, useRef, useEffect } from "react";
import {
  useResourceWatchActions,
  useConnectionLastCtime,
} from "../stores/resource-watch/index.ts";

interface WatchEvent {
  type: "add" | "modify" | "delete";
  path: string;
  metadata?: Record<string, unknown>;
  ctime: number;
}

interface UseResourceWatchOptions {
  resourceUri: string;
  pathFilter?: string;
  enabled?: boolean;
  onNewEvent?: (event: WatchEvent) => void;
  skipHistorical?: boolean;
}

function parseSSEChunk(chunk: string): WatchEvent | null {
  const lines = chunk.trim().split("\n");
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("data: ")) {
      dataLines.push(line.substring(6));
    }
  }

  if (dataLines.length === 0) return null;

  const data = dataLines.join("\n");

  try {
    const fileChangeEvent = JSON.parse(data) as {
      type: "added" | "modified" | "deleted";
      path: string;
      metadata?: Record<string, unknown>;
      timestamp: number;
      patchId: number;
    };

    return {
      type:
        fileChangeEvent.type === "added"
          ? "add"
          : fileChangeEvent.type === "modified"
            ? "modify"
            : "delete",
      path: fileChangeEvent.path,
      metadata: fileChangeEvent.metadata,
      ctime: fileChangeEvent.timestamp,
    };
  } catch (error) {
    console.error("[ResourceWatch] Failed to parse SSE data:", error, data);
    return null;
  }
}

function getAuthToken(): string | null {
  // Guard against SSR - only run in browser
  if (typeof document === "undefined" || typeof window === "undefined") {
    return null;
  }

  const cookies = document.cookie.split(";");
  const tokenChunks: Array<{ index: number; value: string }> = [];

  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");

    if (name.startsWith("sb-auth-auth-token.")) {
      const index = parseInt(name.split(".")[1], 10);
      if (!isNaN(index)) {
        tokenChunks.push({ index, value: decodeURIComponent(value) });
      }
    } else if (name === "sb-auth-auth-token") {
      const encodedToken = decodeURIComponent(value);
      return extractAccessToken(encodedToken);
    }
  }

  if (tokenChunks.length > 0) {
    tokenChunks.sort((a, b) => a.index - b.index);
    const fullToken = tokenChunks.map((c) => c.value).join("");
    return extractAccessToken(fullToken);
  }

  return null;
}

function extractAccessToken(encodedToken: string): string | null {
  try {
    const base64Data = encodedToken.startsWith("base64-")
      ? encodedToken.substring(7)
      : encodedToken;

    const jsonString = globalThis.atob(base64Data);
    const sessionData = JSON.parse(jsonString) as { access_token?: string };
    return sessionData.access_token || null;
  } catch (error) {
    console.error("[ResourceWatch] Failed to extract access token:", error);
    return null;
  }
}

export function useResourceWatch({
  resourceUri,
  pathFilter,
  enabled = true,
  onNewEvent,
  skipHistorical = true,
}: UseResourceWatchOptions) {
  const { locator } = useSDK();
  const { addEvent, setConnected, setError } = useResourceWatchActions();
  const lastCtime = useConnectionLastCtime(resourceUri);
  const token = getAuthToken();

  const watcherId = useMemo(
    () =>
      `resource-watch-${resourceUri}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    [resourceUri],
  );

  const isInitialLoadRef = useRef(true);

  const watchUrl = useMemo(() => {
    if (!locator || !enabled || !token) {
      return null;
    }

    const baseUrl = `/${locator}`;
    const url = new URL(`${baseUrl}/deconfig/watch`, "https://api.decocms.com");

    if (pathFilter) {
      url.searchParams.set("path-filter", pathFilter);
    }

    url.searchParams.set("branch", "main");

    if (lastCtime) {
      url.searchParams.set("from-ctime", String(lastCtime + 1));
    } else {
      url.searchParams.set("from-ctime", "1");
    }

    url.searchParams.set("watcher-id", watcherId);

    return url.toString();
  }, [locator, pathFilter, lastCtime, enabled, watcherId, token]);

  const query = useQuery({
    queryKey: ["resource-watch", resourceUri, pathFilter, watchUrl],
    enabled: Boolean(watchUrl && enabled),
    queryFn: async ({ signal }) => {
      if (!watchUrl) throw new Error("Watch URL not available");

      setConnected(resourceUri, false);
      setError(resourceUri, null);

      const response = await fetch(watchUrl, {
        signal,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });

      if (!response.ok) {
        const error = `Watch failed: ${response.status} ${response.statusText}`;
        console.error("[ResourceWatch] Connection error:", error);
        throw new Error(error);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      setConnected(resourceUri, true);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            setConnected(resourceUri, false);
            break;
          }

          const decoded = decoder.decode(value, { stream: true });
          buffer += decoded;

          const messages = buffer.split("\n\n");
          buffer = messages.pop() || "";

          for (const message of messages) {
            if (!message.trim()) continue;

            const event = parseSSEChunk(message);
            if (event) {
              addEvent(resourceUri, event);

              if (
                onNewEvent &&
                (!skipHistorical || !isInitialLoadRef.current)
              ) {
                onNewEvent(event);
              }
            }
          }

          if (isInitialLoadRef.current && messages.length > 0) {
            isInitialLoadRef.current = false;
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          setConnected(resourceUri, false);
          return;
        }
        throw error;
      }

      return null;
    },
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Handle errors in useEffect to avoid side effects during render
  useEffect(() => {
    if (query.isError) {
      const errorMsg =
        query.error instanceof Error
          ? query.error.message
          : "Watch connection failed";
      console.error("[ResourceWatch] Connection error:", errorMsg);
      setError(resourceUri, errorMsg);
    }
  }, [query.isError, query.error, resourceUri, setError]);

  return query;
}

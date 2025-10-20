import { DECO_CMS_API_URL, useSDK } from "@deco/sdk";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import {
  useConnectionLastCtime,
  useResourceWatchActions,
  WatchEvent,
} from "../stores/resource-watch/index.ts";

interface UseResourceWatchOptions {
  resourceUri: string;
  pathFilter?: string;
  enabled?: boolean;
  onNewEvent?: (event: WatchEvent) => void;
  skipHistorical?: boolean;
}

interface SSEFileChangeEvent {
  type: "added" | "modified" | "deleted";
  path: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
  patchId: number;
}

interface StreamProcessorConfig {
  resourceUri: string;
  reader: ReadableStreamDefaultReader<Uint8Array>;
  signal: AbortSignal;
  onEvent: (event: WatchEvent) => void;
  onConnected: (connected: boolean) => void;
}

function mapEventType(type: SSEFileChangeEvent["type"]): WatchEvent["type"] {
  switch (type) {
    case "added":
      return "add";
    case "modified":
      return "modify";
    case "deleted":
      return "delete";
  }
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
    const fileChangeEvent = JSON.parse(data) as SSEFileChangeEvent;

    return {
      type: mapEventType(fileChangeEvent.type),
      path: fileChangeEvent.path,
      metadata: fileChangeEvent.metadata,
      ctime: fileChangeEvent.timestamp,
    };
  } catch (error) {
    console.error("[ResourceWatch] Failed to parse SSE data:", error, data);
    return null;
  }
}

async function processSSEStream(config: StreamProcessorConfig): Promise<void> {
  const { reader, onEvent, onConnected } = config;
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        onConnected(false);
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
          onEvent(event);
        }
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      onConnected(false);
      return;
    }
    throw error;
  }
}

function generateWatcherId(resourceUri: string): string {
  const timestamp = Date.now();
  const random1 = Math.random().toString(36).slice(2, 11);
  const random2 = Math.random().toString(36).slice(2, 11);
  const random3 = performance.now().toString(36).replace(".", "");
  return `resource-watch-${resourceUri}-${timestamp}-${random1}-${random2}-${random3}`;
}

function buildWatchUrl(
  locator: string,
  pathFilter: string | undefined,
  fromCtime: number | null,
): string {
  const url = new URL(`/${locator}/deconfig/watch`, DECO_CMS_API_URL);

  if (pathFilter) {
    url.searchParams.set("path-filter", pathFilter);
  }

  url.searchParams.set("branch", "main");
  url.searchParams.set("from-ctime", fromCtime ? String(fromCtime + 1) : "1");

  return url.toString();
}

function shouldNotifyEvent(
  event: WatchEvent,
  connectionStartTime: number,
  skipHistorical: boolean,
): boolean {
  if (!skipHistorical) return true;

  const isHistoricalEvent = event.ctime < connectionStartTime;
  return !isHistoricalEvent;
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

  // Capture initial lastCtime to keep URL stable for connection lifecycle
  const initialLastCtimeRef = useRef<number | null>(null);
  if (initialLastCtimeRef.current === null) {
    initialLastCtimeRef.current = lastCtime;
  }

  // Track connection start time to distinguish historical vs new events
  const connectionStartTimeRef = useRef<number | null>(null);

  // Build watch URL with stable parameters
  const watchUrl = useMemo(() => {
    if (!locator || !enabled) {
      return null;
    }

    return buildWatchUrl(locator, pathFilter, initialLastCtimeRef.current);
  }, [locator, pathFilter, enabled]);

  // Set up React Query for SSE connection management
  const query = useQuery({
    queryKey: ["resource-watch", resourceUri, pathFilter] as const,
    enabled: Boolean(watchUrl && enabled),
    gcTime: 0,
    staleTime: 0,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    queryFn: async ({ signal }) => {
      if (!watchUrl) throw new Error("Watch URL not available");

      const watcherId = generateWatcherId(resourceUri);
      const fullUrl = `${watchUrl}&watcher-id=${encodeURIComponent(watcherId)}`;

      connectionStartTimeRef.current = Date.now();

      setConnected(resourceUri, false);
      setError(resourceUri, null);

      const response = await fetch(fullUrl, {
        signal,
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

      await processSSEStream({
        resourceUri,
        reader,
        signal,
        onConnected: (connected) => setConnected(resourceUri, connected),
        onEvent: (event) => {
          addEvent(resourceUri, event);

          const connectionStartTime = connectionStartTimeRef.current || 0;
          const shouldNotify = shouldNotifyEvent(
            event,
            connectionStartTime,
            skipHistorical,
          );

          if (onNewEvent && shouldNotify) {
            onNewEvent(event);
          }
        },
      });

      return null;
    },
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

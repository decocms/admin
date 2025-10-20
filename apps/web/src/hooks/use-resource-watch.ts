import { useQuery } from "@tanstack/react-query";
import { useSDK } from "@deco/sdk";
import { useMemo, useRef, useEffect } from "react";
import {
  useResourceWatchActions,
  useConnectionLastCtime,
} from "../stores/resource-watch/index.ts";

const WATCH_URL = "https://api.decocms.com";
const DEV_MODE = import.meta.env.DEV;

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Authentication Utilities
// ============================================================================

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

// ============================================================================
// SSE Processing Utilities
// ============================================================================

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

// ============================================================================
// URL Building Utilities
// ============================================================================

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
  const baseUrl = `/${locator}`;
  const url = new URL(`${baseUrl}/deconfig/watch`, WATCH_URL);

  if (pathFilter) {
    url.searchParams.set("path-filter", pathFilter);
  }

  url.searchParams.set("branch", "main");
  url.searchParams.set("from-ctime", fromCtime ? String(fromCtime + 1) : "1");

  return url.toString();
}

// ============================================================================
// Event Processing Utilities
// ============================================================================

function shouldNotifyEvent(
  event: WatchEvent,
  connectionStartTime: number,
  skipHistorical: boolean,
): boolean {
  if (!skipHistorical) return true;

  const isHistoricalEvent = event.ctime < connectionStartTime;
  return !isHistoricalEvent;
}

// ============================================================================
// Main Hook
// ============================================================================

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

  // Capture initial lastCtime to keep URL stable for connection lifecycle
  const initialLastCtimeRef = useRef<number | null>(null);
  if (initialLastCtimeRef.current === null) {
    initialLastCtimeRef.current = lastCtime;
  }

  // Track connection start time to distinguish historical vs new events
  const connectionStartTimeRef = useRef<number | null>(null);

  // Build watch URL with stable parameters
  const watchUrl = useMemo(() => {
    if (!locator || !enabled || !token) {
      return null;
    }

    return buildWatchUrl(locator, pathFilter, initialLastCtimeRef.current);
  }, [locator, pathFilter, enabled, token]);

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

      if (DEV_MODE) {
        console.log(`[ResourceWatch] Starting watch with ID: ${watcherId}`);
      }

      setConnected(resourceUri, false);
      setError(resourceUri, null);

      const response = await fetch(fullUrl, {
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

  // Log connection lifecycle in development
  useEffect(() => {
    if (DEV_MODE && enabled) {
      console.log(`[ResourceWatch] Initialized watcher for ${resourceUri}`);
      return () => {
        console.log(`[ResourceWatch] Cleaning up watcher for ${resourceUri}`);
      };
    }
  }, [resourceUri, enabled]);

  return query;
}

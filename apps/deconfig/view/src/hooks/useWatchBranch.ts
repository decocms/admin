import { useEffect, useState, useRef } from "react";

export interface FileChangeEvent {
  type: "added" | "modified" | "deleted";
  path: string;
  metadata?: {
    address: string;
    metadata: Record<string, any>;
    sizeInBytes: number;
    mtime: number;
    ctime: number;
  };
  timestamp: number;
  patchId: number;
}

interface UseWatchBranchOptions {
  branchName: string;
  enabled?: boolean;
  fromCtime?: number;
  pathFilter?: string;
}

interface UseWatchBranchResult {
  events: FileChangeEvent[];
  connectionStatus: "connecting" | "connected" | "disconnected" | "error";
  error: string | null;
  clearEvents: () => void;
}

export function useWatchBranch({
  branchName,
  enabled = true,
  fromCtime,
  pathFilter,
}: UseWatchBranchOptions): UseWatchBranchResult {
  const [events, setEvents] = useState<FileChangeEvent[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected" | "error"
  >("disconnected");
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const clearEvents = () => {
    setEvents([]);
  };

  useEffect(() => {
    if (!enabled || !branchName) {
      return;
    }

    // Build query parameters
    const searchParams = new URLSearchParams();
    searchParams.set("branchName", branchName);
    if (fromCtime !== undefined) {
      searchParams.set("fromCtime", fromCtime.toString());
    }
    if (pathFilter) {
      searchParams.set("pathFilter", pathFilter);
    }

    const watchUrl = `/watch?${searchParams.toString()}`;

    setConnectionStatus("connecting");
    setError(null);

    const eventSource = new EventSource(watchUrl);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnectionStatus("connected");
      setError(null);
    };

    eventSource.addEventListener("change", (event) => {
      try {
        const changeEvent: FileChangeEvent = JSON.parse(event.data);
        setEvents((prev) => [...prev, changeEvent]);
      } catch (err) {
        console.error("Failed to parse SSE event:", err);
        setError("Failed to parse event data");
      }
    });

    // Also handle generic message events (fallback)
    eventSource.onmessage = (event) => {
      try {
        const changeEvent: FileChangeEvent = JSON.parse(event.data);
        setEvents((prev) => [...prev, changeEvent]);
      } catch (err) {
        console.error("Failed to parse SSE event:", err);
        setError("Failed to parse event data");
      }
    };

    eventSource.onerror = (event) => {
      console.error("SSE connection error:", event);
      setConnectionStatus("error");
      setError("Connection error occurred");

      // Auto-reconnect after a delay
      setTimeout(() => {
        if (eventSourceRef.current === eventSource) {
          setConnectionStatus("connecting");
          // The useEffect will handle reconnection due to dependency change
        }
      }, 3000);
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
      setConnectionStatus("disconnected");
    };
  }, [branchName, enabled, fromCtime, pathFilter]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  return {
    events,
    connectionStatus,
    error,
    clearEvents,
  };
}

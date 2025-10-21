import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";

// Maximum number of events to keep in memory per connection
const MAX_EVENTS = 100;

export interface WatchEvent {
  type: "add" | "modify" | "delete";
  path: string;
  metadata?: Record<string, unknown>;
  ctime: number;
}

interface WatchConnection {
  resourceUri: string;
  isConnected: boolean;
  events: WatchEvent[];
  lastCtime: number | null;
  error: string | null;
}

interface State {
  connections: Map<string, WatchConnection>;
}

interface Actions {
  addEvent: (resourceUri: string, event: WatchEvent) => void;
  setConnected: (resourceUri: string, connected: boolean) => void;
  setError: (resourceUri: string, error: string | null) => void;
  reset: (resourceUri: string) => void;
}

interface ResourceWatchStore extends State {
  actions: Actions;
}

// ✅ Use type hints for empty Map to prevent TypeScript inference issues
export const createResourceWatchStore = create<ResourceWatchStore>()((set) => ({
  connections: new Map([] as [string, WatchConnection][]),

  actions: {
    addEvent: (resourceUri, event) => {
      set((state) => {
        // ✅ Always create new Map instance for immutability
        const connections = new Map(state.connections);
        const conn = connections.get(resourceUri) || {
          resourceUri,
          isConnected: false,
          events: [],
          lastCtime: null,
          error: null,
        };

        // Cap events array to MAX_EVENTS, keeping only the most recent
        const updatedEvents = [...conn.events, event].slice(-MAX_EVENTS);

        // Ensure lastCtime is monotonic (always increases, never goes backwards)
        const updatedLastCtime = Math.max(
          conn.lastCtime ?? -Infinity,
          event.ctime,
        );

        connections.set(resourceUri, {
          ...conn,
          events: updatedEvents,
          lastCtime: updatedLastCtime,
          error: null,
        });

        return { connections };
      });
    },

    setConnected: (resourceUri, connected) => {
      set((state) => {
        const connections = new Map(state.connections);
        const conn = connections.get(resourceUri) || {
          resourceUri,
          isConnected: false,
          events: [],
          lastCtime: null,
          error: null,
        };

        connections.set(resourceUri, {
          ...conn,
          isConnected: connected,
          error: connected ? null : conn.error,
        });

        return { connections };
      });
    },

    setError: (resourceUri, error) => {
      set((state) => {
        const connections = new Map(state.connections);
        const conn = connections.get(resourceUri) || {
          resourceUri,
          isConnected: false,
          events: [],
          lastCtime: null,
          error: null,
        };

        connections.set(resourceUri, {
          ...conn,
          error,
          isConnected: false,
        });

        return { connections };
      });
    },

    reset: (resourceUri) => {
      set((state) => {
        const connections = new Map(state.connections);
        connections.delete(resourceUri);
        return { connections };
      });
    },
  },
}));

// ✅ Export atomic selectors only, never the store directly
export function useResourceWatchActions() {
  return createResourceWatchStore((state) => state.actions);
}

export function useConnectionLastCtime(resourceUri: string) {
  return createResourceWatchStore(
    (s) => s.connections.get(resourceUri)?.lastCtime ?? null,
  );
}

export function useConnectionStatus(resourceUri: string) {
  return createResourceWatchStore(
    useShallow((s) => {
      const conn = s.connections.get(resourceUri);
      return {
        isConnected: conn?.isConnected ?? false,
        error: conn?.error ?? null,
        eventCount: conn?.events.length ?? 0,
      };
    }),
  );
}

// ✅ Allow access outside React for special cases
export function getConnection(resourceUri: string): WatchConnection {
  const conn = createResourceWatchStore.getState().connections.get(resourceUri);
  return (
    conn || {
      resourceUri,
      isConnected: false,
      events: [],
      lastCtime: null,
      error: null,
    }
  );
}

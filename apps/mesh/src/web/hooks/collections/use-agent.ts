/**
 * Agent Collection Hooks
 *
 * Provides React hooks for working with agents from remote connections
 * using TanStack DB collections and live queries.
 */

import { createToolCaller, UNKNOWN_CONNECTION_ID } from "../../../tools/client";
import {
  createCollectionFromToolCaller,
  useCollectionList,
  type UseCollectionListOptions,
} from "../use-collections";

// Agent type matching AgentSchema from @decocms/bindings
export interface Agent {
  id: string;
  title: string;
  description: string;
  instructions: string;
  tool_set: Record<string, string[]>;
  avatar: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

// Cache for agents collections per connection
const agentsCollectionCache = new Map<
  string,
  ReturnType<typeof createCollectionFromToolCaller<Agent>>
>();

/**
 * Get or create an agents collection for a specific connection.
 * Collections are cached per connectionId.
 */
function getOrCreateAgentsCollection(connectionId: string) {
  let collection = agentsCollectionCache.get(connectionId);

  if (!collection) {
    collection = createCollectionFromToolCaller<Agent>({
      collectionName: "AGENT",
      toolCaller: createToolCaller(connectionId),
    });
    agentsCollectionCache.set(connectionId, collection);
  }

  return collection;
}

/**
 * Options for useAgentsFromConnection hook
 */
export type UseAgentsOptions = UseCollectionListOptions<Agent>;

/**
 * Hook to get all agents from a specific connection with live query reactivity
 *
 * @param connectionId - The ID of the connection to fetch agents from
 * @param options - Filter and configuration options
 * @returns Live query result with agents
 */
export function useAgentsFromConnection(
  connectionId: string | undefined,
  options: UseAgentsOptions = {},
) {
  // Use a placeholder ID when connectionId is undefined to ensure hooks are always called
  // in the same order (Rules of Hooks compliance)
  const collection = getOrCreateAgentsCollection(
    connectionId ?? UNKNOWN_CONNECTION_ID,
  );
  const result = useCollectionList(collection, options);

  return result;
}

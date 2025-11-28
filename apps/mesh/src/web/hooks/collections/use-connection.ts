/**
 * Connection Collection Hooks
 *
 * Provides React hooks for working with connections using TanStack DB collections
 * and live queries. These hooks offer a reactive interface for accessing and
 * manipulating connections.
 */

import { createBindingChecker } from "@decocms/bindings";
import {
  BaseCollectionEntitySchema,
  createCollectionBindings,
} from "@decocms/bindings/collections";
import { useEffect, useMemo, useState } from "react";
import { createToolCaller } from "../../../tools/client";
import type { ConnectionEntity } from "../../../tools/connection/schema";
import {
  type CollectionFilter,
  createCollectionFromToolCaller,
  useCollectionItem,
  useCollectionList,
  type UseCollectionListOptions,
} from "../use-collections";

// Module-level singleton to store the collection instance
let connectionsCollectionSingleton: ReturnType<
  typeof createCollectionFromToolCaller<ConnectionEntity>
> | null = null;

/**
 * Get or create the connections collection singleton.
 * This is at module scope to ensure true singleton behavior.
 */
function getOrCreateConnectionsCollection() {
  connectionsCollectionSingleton ??=
    createCollectionFromToolCaller<ConnectionEntity>({
      toolCaller: createToolCaller(),
      collectionName: "CONNECTIONS",
    });

  return connectionsCollectionSingleton;
}

/**
 * Hook to get the connections collection
 *
 * Uses createToolCaller() (no connectionId) to route to the mesh API.
 * The collection is a singleton shared across all components.
 *
 * @returns The connections collection with CRUD operations
 */
export function useConnectionsCollection() {
  return getOrCreateConnectionsCollection();
}

/**
 * Filter definition for connections (matches @deco/ui Filter shape)
 */
export type ConnectionFilter = CollectionFilter;

/**
 * Options for useConnections hook
 */
export type UseConnectionsOptions = UseCollectionListOptions<ConnectionEntity>;

/**
 * Hook to get all connections with live query reactivity
 *
 * @param options - Filter and configuration options
 * @returns Live query result with connections as ConnectionEntity, plus the original collection for mutations
 */
export function useConnections(options: UseConnectionsOptions = {}) {
  const collection = useConnectionsCollection();
  return useCollectionList(collection, options);
}

/**
 * Hook to get a single connection by ID with live query reactivity
 *
 * @param connectionId - The ID of the connection to fetch
 * @returns Live query result with the connection as ConnectionEntity, plus the original collection for mutations
 */
export function useConnection(connectionId: string | undefined) {
  const collection = useConnectionsCollection();
  return useCollectionItem(collection, connectionId);
}

/**
 * Re-export ConnectionEntity type for convenience
 */
export type { ConnectionEntity };

/**
 * Validated collection binding
 */
export interface ValidatedCollection {
  name: string;
  displayName: string;
}

/**
 * Formats a collection name for display
 * e.g., "LLM" -> "Llm", "USER_PROFILES" -> "User Profiles"
 */
function formatCollectionName(name: string): string {
  return name
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Extracts collection names from tools using regex pattern
 * Matches COLLECTION_{NAME}_LIST where NAME can contain underscores
 */
function extractCollectionNames(
  tools: Array<{ name: string }> | null | undefined,
): string[] {
  if (!tools || tools.length === 0) return [];

  const collectionRegex = /^COLLECTION_(.+)_LIST$/;
  const names: string[] = [];

  for (const tool of tools) {
    const match = tool.name.match(collectionRegex);
    if (match?.[1]) {
      names.push(match[1]);
    }
  }

  return names;
}

/**
 * Detects and validates collection bindings from tools
 */
async function detectCollections(
  tools: Array<{
    name: string;
    inputSchema?: Record<string, unknown>;
  }> | null,
): Promise<ValidatedCollection[]> {
  if (!tools || tools.length === 0) {
    return [];
  }

  const potentialCollections = extractCollectionNames(tools);

  if (potentialCollections.length === 0) {
    return [];
  }

  const validatedCollections: ValidatedCollection[] = [];

  for (const collectionName of potentialCollections) {
    try {
      // Create a minimal collection binding to check against (read-only)
      const binding = createCollectionBindings(
        collectionName.toLowerCase(),
        BaseCollectionEntitySchema,
        { readOnly: true },
      );

      // For collection detection, we only validate input schema compatibility.
      // Output schema validation is skipped because:
      // 1. The binding uses BaseCollectionEntitySchema with minimal required fields
      // 2. Actual collections have additional required fields (description, instructions, etc.)
      // 3. json-schema-diff sees extra required fields as "removals" (stricter schema)
      const toolsForChecker = tools.map((t) => ({
        name: t.name,
        inputSchema: t.inputSchema,
        // outputSchema intentionally omitted for detection
      }));

      // Create binding without output schemas for the same reason
      const bindingForChecker = binding.map((b) => ({
        name: b.name,
        inputSchema: b.inputSchema,
        opt: b.opt,
      }));

      const checker = createBindingChecker(bindingForChecker);
      const isValid = checker.isImplementedBy(toolsForChecker);

      if (isValid) {
        validatedCollections.push({
          name: collectionName,
          displayName: formatCollectionName(collectionName),
        });
      }
    } catch {
      // Skip collections that fail validation
    }
  }

  return validatedCollections;
}

/**
 * Hook to detect and validate collection bindings from connection tools
 * Runs entirely client-side using the connection's tools array
 *
 * @param connectionId - The ID of the connection to analyze
 * @returns Object with collections array and loading state
 */
export function useCollectionBindings(connectionId: string | undefined): {
  collections: ValidatedCollection[];
  isLoading: boolean;
} {
  const { data: connection, isPending: connectionLoading } =
    useConnection(connectionId);
  const [collections, setCollections] = useState<ValidatedCollection[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);

  // Memoize tools to avoid unnecessary re-runs
  const tools = useMemo(() => connection?.tools ?? null, [connection?.tools]);

  useEffect(() => {
    if (!tools) {
      setCollections([]);
      return;
    }

    let cancelled = false;
    setIsDetecting(true);

    detectCollections(tools).then((result) => {
      if (!cancelled) {
        setCollections(result);
        setIsDetecting(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [tools]);

  return {
    collections,
    isLoading: connectionLoading || isDetecting,
  };
}


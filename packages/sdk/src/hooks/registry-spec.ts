/**
 * React Query Hooks - MCP Registry Spec
 *
 * Hooks that implement the official MCP Registry Spec, with transparent
 * translation from Deco backend to standard format.
 */

import { useSuspenseQuery, UseQueryOptions } from "@tanstack/react-query";
import { MCPClient } from "../fetcher";
import { useSDK } from "./store";
import {
  adaptDecoToMCPRegistry,
  adaptMultipleToMCPRegistry,
  type DecoMarketplaceIntegration,
} from "../mcp/registry-spec/adapter";
import type {
  MCPRegistryServer,
  MCPRegistrySearchResponse,
} from "../mcp/registry-spec/schema";
import { KEYS } from "./react-query-keys";

/**
 * Interface extension for internal compatibility
 */
export interface MCPRegistrySearchResult {
  servers: MCPRegistryServer[];
  total?: number;
}

/**
 * Hook to fetch integrations marketplace in MCP Registry Spec format
 *
 * Internally:
 * 1. Calls DECO_INTEGRATIONS_SEARCH from Deco backend
 * 2. Translates response to MCP Registry format
 * 3. Cache via React Query
 *
 * Usage:
 * ```tsx
 * const { data, isLoading } = useMCPRegistryMarketplace();
 * ```
 */
export const useMCPRegistryMarketplace = (
  queryOptions?: Omit<UseQueryOptions<MCPRegistrySearchResult>, 'queryKey' | 'queryFn'>
) => {
  const { locator } = useSDK();

  return useSuspenseQuery<MCPRegistrySearchResult>({
    queryKey: KEYS.MCP_REGISTRY_MARKETPLACE(),
    queryFn: async () => {
      try {
        // 1. Fetch from Deco backend
        const result = await MCPClient.forLocator(locator).DECO_INTEGRATIONS_SEARCH(
          { query: "" }
        );

        // Check if result is valid
        if (typeof result === "string" || !result) {
          return { servers: [] };
        }

        if (!Array.isArray(result.integrations)) {
          return { servers: [] };
        }

        // 2. Adapt to MCP Registry Schema
        const adaptedServers = adaptMultipleToMCPRegistry(
          result.integrations as DecoMarketplaceIntegration[]
        );

        // 3. Return in MCP Registry format
        return {
          servers: adaptedServers,
          total: adaptedServers.length,
        };
      } catch (error) {
        console.error("Error fetching marketplace:", error);
        return { servers: [] };
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
    ...queryOptions,
  });
};

/**
 * Hook to fetch a specific server from marketplace
 */
export const useMCPRegistryServer = (
  serverId: string,
  queryOptions?: UseQueryOptions<MCPRegistryServer | null>
) => {
  const { data: marketplace } = useMCPRegistryMarketplace();

  // Search for server in cached marketplace
  const server =
    marketplace?.servers?.find((s) => s.id === serverId) || null;

  return {
    data: server,
    isLoading: !marketplace,
    isError: false,
  };
};

/**
 * Hook to filter and search servers in marketplace
 */
export const useMCPRegistrySearch = (
  query: string = "",
  queryOptions?: Omit<UseQueryOptions<MCPRegistrySearchResult>, 'queryKey' | 'queryFn'>
) => {
  const { locator } = useSDK();

  return useSuspenseQuery<MCPRegistrySearchResult>({
    queryKey: KEYS.MCP_REGISTRY_SEARCH(query),
    queryFn: async () => {
      try {
        // Fetch from Deco backend with query
        const result = await MCPClient.forLocator(locator).DECO_INTEGRATIONS_SEARCH(
          { query }
        );

        if (typeof result === "string" || !result) {
          return { servers: [] };
        }

        if (!Array.isArray(result.integrations)) {
          return { servers: [] };
        }

        // Adapt to MCP Registry Schema
        const adaptedServers = adaptMultipleToMCPRegistry(
          result.integrations as DecoMarketplaceIntegration[]
        );

        return {
          servers: adaptedServers,
          total: adaptedServers.length,
        };
      } catch (error) {
        console.error("Error fetching with query:", error);
        return { servers: [] };
      }
    },
    enabled: !!locator,
    staleTime: 1000 * 60 * 3, // 3 minutes
    retry: 2,
    ...queryOptions,
  });
};

/**
 * Hook to filter servers by binding
 */
export const useMCPRegistryByBinding = (binding: string) => {
  const { data: marketplace, isLoading } = useMCPRegistryMarketplace();

  // Filter locally by binding in capabilities
  const filtered = {
    servers:
      marketplace?.servers?.filter(
        (server: MCPRegistryServer) =>
          server.capabilities?.includes(binding) ||
          server.tags?.includes(binding)
      ) || [],
  };

  return {
    data: filtered,
    isLoading,
  };
};

/**
 * Hook to filter servers by tags
 */
export const useMCPRegistryByTag = (tag: string) => {
  const { data: marketplace, isLoading } = useMCPRegistryMarketplace();

  // Filter locally by tag
  const filtered = {
    servers:
      marketplace?.servers?.filter((server: MCPRegistryServer) =>
        server.tags?.includes(tag)
      ) || [],
  };

  return {
    data: filtered,
    isLoading,
  };
};

/**
 * Hook to list only verified servers
 */
export const useMCPRegistryVerified = () => {
  const { data: marketplace, isLoading } = useMCPRegistryMarketplace();

  const filtered = {
    servers: marketplace?.servers?.filter((server: MCPRegistryServer) => server.verified) || [],
  };

  return {
    data: filtered,
    isLoading,
  };
};

/**
 * Hook to list only featured servers
 */
export const useMCPRegistryFeatured = () => {
  const { data: marketplace, isLoading } = useMCPRegistryMarketplace();

  const filtered = {
    servers: marketplace?.servers?.filter((server: MCPRegistryServer) => server.featured) || [],
  };

  return {
    data: filtered,
    isLoading,
  };
};


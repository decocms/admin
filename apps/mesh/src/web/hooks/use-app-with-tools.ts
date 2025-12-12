/**
 * useAppWithTools Hook
 *
 * Fetches app data and its tools together in a single React Query request
 * Handles remote tool fetching from MCP server URL automatically
 */

import { useQuery } from "@tanstack/react-query";
import { KEYS } from "../lib/query-keys";
import { createToolCaller } from "@/tools/client";
import type { RegistryItem } from "@/web/components/store/registry-items-section";

interface RemoteTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

interface RemoteToolsResponse {
  tools?: RemoteTool[];
  error?: string;
  message?: string;
}

interface VersionsResponse {
  versions?: RegistryItem[];
  servers?: RegistryItem[];
  server?: RegistryItem;
  count?: number;
  metadata?: { count?: number };
}

interface ListResponse {
  servers?: RegistryItem[];
  items?: RegistryItem[];
  count?: number;
  metadata?: { count?: number };
}

type ToolType = Array<{
  id?: string;
  name?: string;
  description?: string | null;
}> | RemoteTool[] | Array<Record<string, unknown>>;

interface AppWithToolsData {
  app: RegistryItem;
  tools: ToolType;
  remoteToolsLoaded: boolean;
}

interface UseAppWithToolsOptions {
  registryId: string;
  /** Server name (for versions endpoint) or null (for list endpoint) */
  serverName: string | null | undefined;
  enabled?: boolean;
}

/**
 * Fetches app data and its tools together
 * - If serverName provided: fetches specific app versions via COLLECTION_REGISTRY_APP_VERSIONS
 * - If no serverName: fetches app list via COLLECTION_REGISTRY_APP_LIST
 * - Automatically fetches remote tools from server.remotes[0].url if local tools are empty
 *
 * @example
 * ```tsx
 * // Fetch specific app with versions
 * const { data, isLoading, error } = useAppWithTools({
 *   registryId: "conn_123",
 *   serverName: "ai.exa/exa",
 *   enabled: !!serverName,
 * });
 *
 * // Fetch app list
 * const { data, isLoading, error } = useAppWithTools({
 *   registryId: "conn_123",
 *   serverName: null,
 *   enabled: true,
 * });
 * ```
 */
export function useAppWithTools(options: UseAppWithToolsOptions) {
  const { registryId, serverName, enabled = true } = options;
  const toolCaller = createToolCaller(registryId);

  return useQuery({
    queryKey: KEYS.appWithTools(registryId, serverName ?? ""),
    queryFn: async (): Promise<AppWithToolsData> => {
      if (!registryId) {
        throw new Error("registryId is required");
      }

      let appData: RegistryItem | RegistryItem[] | null = null;
      let remoteUrl: string | null = null;

      try {
        // Step 1: Fetch app data
        if (serverName) {
          // Fetch specific app versions
          const versionsResult = (await toolCaller(
            "COLLECTION_REGISTRY_APP_VERSIONS",
            { name: serverName },
          )) as unknown;

          if (versionsResult) {
            const versionData = versionsResult as VersionsResponse | RegistryItem[] | RegistryItem | null;

            // Handle different response formats
            if (Array.isArray(versionData)) {
              const firstItem = versionData[0];
              if (firstItem) {
                appData = firstItem;
              }
            } else if (
              typeof versionData === "object" &&
              versionData !== null &&
              "versions" in versionData &&
              Array.isArray(versionData.versions) &&
              versionData.versions.length > 0
            ) {
              const versionItem = versionData.versions[0];
              if (versionItem) {
                appData = versionItem;
              }
            } else if (
              typeof versionData === "object" &&
              versionData !== null &&
              "servers" in versionData &&
              Array.isArray(versionData.servers) &&
              versionData.servers.length > 0
            ) {
              const serverItem = versionData.servers[0];
              if (serverItem) {
                appData = serverItem;
              }
            } else if (
              typeof versionData === "object" &&
              versionData !== null &&
              "server" in versionData
            ) {
              appData = versionData as RegistryItem;
            }
          }
        } else {
          // Fetch app list
          const listResult = (await toolCaller(
            "COLLECTION_REGISTRY_APP_LIST",
            {},
          )) as unknown;

          if (listResult) {
            const listData = listResult as ListResponse | RegistryItem[] | null;

            if (Array.isArray(listData)) {
              appData = listData;
            } else if (
              typeof listData === "object" &&
              listData !== null &&
              "servers" in listData &&
              Array.isArray(listData.servers) &&
              listData.servers.length > 0
            ) {
              appData = listData.servers;
            } else if (
              typeof listData === "object" &&
              listData !== null &&
              "items" in listData &&
              Array.isArray(listData.items) &&
              listData.items.length > 0
            ) {
              appData = listData.items;
            }
          }
        }

        if (!appData) {
          throw new Error("Failed to fetch app data");
        }

        // Convert to array for consistent processing
        const appArray = Array.isArray(appData) ? appData : [appData];
        const selectedApp = appArray[0];

        if (!selectedApp) {
          throw new Error("No app data available");
        }

        // Step 2: Check for local tools
        const localToolsList = (selectedApp.tools || selectedApp.server?.tools || []) as ToolType;
        const hasLocalTools = Array.isArray(localToolsList) && localToolsList.length > 0;

        // If has local tools, return them
        if (hasLocalTools) {
          return {
            app: selectedApp,
            tools: localToolsList,
            remoteToolsLoaded: false,
          };
        }

        // Step 3: Fetch remote tools if no local tools
        remoteUrl = selectedApp.server?.remotes?.[0]?.url ?? null;

        if (remoteUrl) {
          try {
            const remoteResponse = await fetch("/api/registry/tools", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              credentials: "include",
              body: JSON.stringify({ url: remoteUrl }),
            });

            if (remoteResponse.ok) {
              const remoteData = (await remoteResponse.json()) as RemoteToolsResponse;
              const remoteTools = remoteData.tools ?? [];

              return {
                app: selectedApp,
                tools: remoteTools,
                remoteToolsLoaded: true,
              };
            }
          } catch (error) {
            console.error("Failed to fetch remote tools:", error);
          }
        }

        // Return app with empty tools if remote fetch fails
        return {
          app: selectedApp,
          tools: [] as RemoteTool[],
          remoteToolsLoaded: false,
        };
      } catch (error) {
        throw error;
      }
    },
    enabled: enabled && !!registryId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes (formerly cacheTime)
  });
}


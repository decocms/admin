/**
 * Registry Tools Hooks
 *
 * Custom hooks for fetching registry data:
 * - useRegistryAppList: Fetch list of all available apps
 * - useRegistryAppVersions: Fetch all versions of a specific app
 */

import { useToolCall } from "./use-tool-call";
import { createToolCaller } from "@/tools/client";

interface UseRegistryAppListOptions {
  registryId: string;
  enabled?: boolean;
}

interface UseRegistryAppVersionsOptions {
  registryId: string;
  appName: string | null | undefined;
  enabled?: boolean;
}

/**
 * Fetch the complete list of apps from the registry
 * Uses COLLECTION_REGISTRY_APP_LIST tool
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useRegistryAppList({
 *   registryId: "conn_123",
 *   enabled: !!registryId,
 * });
 * ```
 */
export function useRegistryAppList(options: UseRegistryAppListOptions) {
  const { registryId, enabled = true } = options;
  const toolCaller = createToolCaller(registryId);

  return useToolCall({
    toolCaller,
    toolName: "COLLECTION_REGISTRY_APP_LIST",
    toolInputParams: {},
    connectionId: registryId,
    enabled: enabled && !!registryId,
  });
}

interface UseRegistryAppGetOptions {
  registryId: string;
  appName: string | null | undefined;
  enabled?: boolean;
}

/**
 * Fetch a specific app by name from the registry
 * Uses COLLECTION_REGISTRY_APP_GET tool
 * Can be used as a fallback when VERSIONS is not available
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useRegistryAppGet({
 *   registryId: "conn_123",
 *   appName: "ai.exa/exa",
 *   enabled: !!appName,
 * });
 * ```
 */
export function useRegistryAppGet(options: UseRegistryAppGetOptions) {
  const { registryId, appName, enabled = true } = options;
  const toolCaller = createToolCaller(registryId);

  return useToolCall({
    toolCaller,
    toolName: "COLLECTION_REGISTRY_APP_GET",
    toolInputParams: appName ? { name: appName } : {},
    connectionId: registryId,
    enabled: enabled && !!registryId && !!appName,
  });
}

/**
 * Fetch all versions of a specific app from the registry
 * Uses COLLECTION_REGISTRY_APP_VERSIONS tool
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useRegistryAppVersions({
 *   registryId: "conn_123",
 *   appName: "ai.exa/exa",
 *   enabled: !!appName,
 * });
 * ```
 */
export function useRegistryAppVersions(
  options: UseRegistryAppVersionsOptions,
) {
  const { registryId, appName, enabled = true } = options;
  const toolCaller = createToolCaller(registryId);

  return useToolCall({
    toolCaller,
    toolName: "COLLECTION_REGISTRY_APP_VERSIONS",
    toolInputParams: appName ? { name: appName } : {},
    connectionId: registryId,
    enabled: enabled && !!registryId && !!appName,
  });
}


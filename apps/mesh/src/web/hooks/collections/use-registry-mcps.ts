import { useConnection } from "./use-connection";

/**
 * Hook to get a registry connection by ID
 */
export function useRegistryMCPs(registryId: string | undefined) {
  return useConnection(registryId);
}

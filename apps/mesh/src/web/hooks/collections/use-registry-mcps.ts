import { useConnection, type ConnectionEntity } from "./use-connection";

/**
 * MCP type - represents a connection entity in the registry
 */
export type MCP = ConnectionEntity;

/**
 * Hook to get a registry connection by ID
 */
export function useRegistryMCPs(registryId: string | undefined) {
  return useConnection(registryId);
}

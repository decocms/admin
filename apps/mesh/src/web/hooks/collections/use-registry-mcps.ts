/**
 * Hook to get MCPs from a specific registry/connection
 *
 * Uses the tools field from the connection to list available MCPs
 */

import { useMemo } from "react";
import { useConnection } from "./use-connection";
import type { ToolDefinition } from "@/tools/connection/schema";

export interface MCP {
  id: string;
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

/**
 * Hook to get MCPs from a specific registry connection
 *
 * @param registryId - The ID of the registry/connection to fetch MCPs from
 * @returns List of MCPs with their definitions
 */
export function useRegistryMCPs(registryId: string | undefined) {
  const { data: connection, ...rest } = useConnection(registryId);

  const mcps = useMemo(() => {
    if (!connection?.tools) {
      return [];
    }

    return connection.tools.map((tool: ToolDefinition, index: number) => ({
      id: tool.name || `tool-${index}`,
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
    }));
  }, [connection?.tools]);

  return {
    data: mcps,
    ...rest,
  };
}


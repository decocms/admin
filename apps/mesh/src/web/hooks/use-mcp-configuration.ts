import { createToolCaller } from "@/tools/client";
import { useToolCall } from "./use-tool-call";
import type { McpConfigurationOutput } from "@decocms/bindings/mcp";

/**
 * Hook to fetch MCP configuration (schema and scopes) for a connection
 *
 * @param connectionId - The connection ID to fetch configuration for (required)
 * @returns Query result with stateSchema and scopes
 * @throws Suspends during loading, throws on error
 *
 * Note: This hook uses Suspense and must be wrapped in a Suspense boundary.
 * Only call this hook when connectionId is available.
 */
export function useMcpConfiguration(connectionId: string) {
  const toolCaller = createToolCaller(connectionId);

  return useToolCall<Record<string, never>, McpConfigurationOutput>({
    toolCaller,
    toolName: "MCP_CONFIGURATION",
    toolInputParams: {},
    staleTime: Infinity, // Cache forever
  });
}

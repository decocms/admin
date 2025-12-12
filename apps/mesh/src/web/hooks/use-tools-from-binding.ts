import { useMemo } from "react";
import { createToolCaller } from "@/tools/client";
import type { RegistryItem } from "@/web/components/store/registry-items-section";
import { useConnections } from "@/web/hooks/collections/use-connection";
import { useRegistryConnections } from "@/web/hooks/use-binding";
import { useToolCall } from "@/web/hooks/use-tool-call";
import { getToolsFromBindingType } from "@/web/utils/extract-connection-data";
import {
  findListToolName,
  extractItemsFromResponse,
} from "@/web/utils/registry-utils";

/**
 * Hook to get tools from a binding type in the registry
 * @param bindingType - Binding type string (e.g., "@deco/database")
 * @returns Object with tools array, loading state, and error
 */
export function useToolsFromBinding(bindingType: string | undefined) {
  const allConnections = useConnections();
  const registryConnections = useRegistryConnections(allConnections);

  const registryId = registryConnections[0]?.id || "";
  const registryConnection = registryConnections[0];

  const listToolName = findListToolName(registryConnection?.tools);
  const toolCaller = createToolCaller(registryId);

  const { data: listResults, isLoading, error } = useToolCall({
    toolCaller,
    toolName: listToolName,
    toolInputParams: {},
    connectionId: registryId,
    enabled: !!listToolName && !!registryId && !!bindingType,
  });

  const registryItems = extractItemsFromResponse<RegistryItem>(listResults);

  const tools = useMemo(() => {
    if (!bindingType) return [];
    return getToolsFromBindingType(registryItems, bindingType);
  }, [registryItems, bindingType]);

  return { tools, isLoading, error };
}


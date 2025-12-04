import { useMemo } from "react";
import { useConnection } from "@/web/hooks/collections/use-connection";
import { useToolCall } from "@/web/hooks/use-tool-call";
import { createToolCaller } from "@/tools/client";
import { StoreDiscoveryUI } from "./store-discovery-ui";
import type { RegistryItem } from "./registry-items-section";

interface StoreDiscoveryProps {
  registryId: string;
}

export function StoreDiscovery({ registryId }: StoreDiscoveryProps) {
  const { data: registryConnection } = useConnection(registryId);

  // Find the LIST tool from the registry connection
  const listToolName = useMemo(() => {
    if (!registryConnection?.tools) return "";
    const listTool = registryConnection.tools.find((tool) =>
      tool.name.endsWith("_LIST"),
    );
    return listTool?.name || "";
  }, [registryConnection?.tools]);

  const toolCaller = useMemo(() => createToolCaller(registryId), [registryId]);

  const {
    data: listResults,
    isLoading,
    error,
  } = useToolCall({
    toolCaller,
    toolName: listToolName,
    toolInputParams: {},
    enabled: !!listToolName,
  });

  // Extract items from results without transformation
  const items: RegistryItem[] = useMemo(() => {
    if (!listResults) return [];

    // Direct array response
    if (Array.isArray(listResults)) {
      return listResults;
    }

    // Object with nested array
    if (typeof listResults === "object" && listResults !== null) {
      const itemsKey = Object.keys(listResults).find((key) =>
        Array.isArray(listResults[key as keyof typeof listResults]),
      );

      if (itemsKey) {
        return listResults[
          itemsKey as keyof typeof listResults
        ] as RegistryItem[];
      }
    }

    return [];
  }, [listResults]);

  return (
    <StoreDiscoveryUI
      items={items}
      isLoading={isLoading}
      error={error}
      registryId={registryId}
    />
  );
}

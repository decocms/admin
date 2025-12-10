import { useConnection } from "@/web/hooks/collections/use-connection";
import { useToolCall } from "@/web/hooks/use-tool-call";
import { createToolCaller } from "@/tools/client";
import { StoreDiscoveryUI } from "./store-discovery-ui";
import type { RegistryItem } from "./registry-items-section";

interface StoreDiscoveryProps {
  registryId: string;
}

export function StoreDiscovery({ registryId }: StoreDiscoveryProps) {
  const registryConnection = useConnection(registryId);

  // Find the LIST tool from the registry connection
  const listToolName = !registryConnection?.tools
    ? ""
    : (() => {
        const listTool = registryConnection.tools.find((tool) =>
          tool.name.endsWith("_LIST"),
        );
        return listTool?.name || "";
      })();

  const toolCaller = createToolCaller(registryId);

  const {
    data: listResults,
    isLoading,
    error,
  } = useToolCall({
    toolCaller,
    toolName: listToolName,
    toolInputParams: {},
    connectionId: registryId,
    enabled: !!listToolName,
  });

  // Extract items from results without transformation
  const items: RegistryItem[] = !listResults
    ? []
    : // Direct array response
      Array.isArray(listResults)
      ? listResults
      : // Object with nested array
        typeof listResults === "object" && listResults !== null
        ? (() => {
            const itemsKey = Object.keys(listResults).find((key) =>
              Array.isArray(listResults[key as keyof typeof listResults]),
            );

            if (itemsKey) {
              return listResults[
                itemsKey as keyof typeof listResults
              ] as RegistryItem[];
            }
            return [];
          })()
        : [];

  return (
    <StoreDiscoveryUI
      items={items}
      isLoading={isLoading}
      error={error}
      registryId={registryId}
    />
  );
}

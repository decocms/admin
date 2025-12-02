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
  // Get the registry connection to find its LIST tool
  const { data: registryConnection } = useConnection(registryId);

  // Find the LIST tool from the registry connection
  const listToolName = useMemo(() => {
    if (!registryConnection?.tools) return "";
    // Find the first tool that ends with _LIST
    const listTool = registryConnection.tools.find(
      (tool) => tool.name.endsWith("_LIST")
    );
    return listTool?.name || "";
  }, [registryConnection?.tools]);

  // Get tool caller for the registry connection
  const toolCaller = useMemo(() => createToolCaller(registryId), [registryId]);

  // Call the LIST tool to get items
  // Provide a default empty object to avoid React Query undefined error
  const {
    data: listResults = {},
    isLoading: isLoadingList,
    error: listError,
  } = useToolCall({
    toolCaller,
    toolName: listToolName,
    toolInputParams: {},
    enabled: !!listToolName,
  });

  // Transform results to registry items
  const items: RegistryItem[] = useMemo(() => {
    if (!listResults || Object.keys(listResults).length === 0) {
      console.log("listResults is empty or undefined:", listResults);
      return [];
    }

    console.log("Raw listResults from tool:", listResults);
    console.log("listResults type:", typeof listResults);
    console.log("listResults keys:", Object.keys(listResults || {}));

    // Helper function to transform a single item
    const transformItem = (item: any, idx: number): RegistryItem => ({
      id: item.id || item.uuid || `item-${idx}`,
      name:
        item.name ||
        item.title ||
        item.displayName ||
        item.friendlyName ||
        `Item ${idx + 1}`,
      description:
        item.description ||
        item.summary ||
        item.subtitle ||
        item.shortDescription ||
        undefined,
      icon:
        item.icon ||
        item.image ||
        item.logo ||
        item.iconUrl ||
        item.imageUrl ||
        undefined,
    });

    // Handle different response structures
    if (Array.isArray(listResults)) {
      console.log("Response is array with", listResults.length, "items");
      return listResults.map((item: any, idx: number) =>
        transformItem(item, idx)
      );
    }

    if (typeof listResults === "object" && listResults !== null) {
      // Try to find an array in the response
      const itemsKey = Object.keys(listResults).find(
        (key) => Array.isArray(listResults[key as keyof typeof listResults])
      );

      console.log("Found items key:", itemsKey);

      if (itemsKey) {
        const itemsArray = listResults[
          itemsKey as keyof typeof listResults
        ] as any[];
        console.log("Transforming", itemsArray.length, "items from key:", itemsKey);
        return itemsArray.map((item, idx) => transformItem(item, idx));
      } else {
        console.log("No array found in response. Available keys:", Object.keys(listResults));
        // Log the full structure
        console.log("Full response structure:", JSON.stringify(listResults, null, 2));
      }
    }

    return [];
  }, [listResults]);

  const handleItemClick = (item: RegistryItem) => {
    // Can be extended to perform actions on item click
    console.log("Item clicked:", item);
  };

  return (
    <StoreDiscoveryUI
      items={items}
      isLoading={isLoadingList}
      error={listError}
      onItemClick={handleItemClick}
    />
  );
}


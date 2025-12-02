import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useConnection } from "@/web/hooks/collections/use-connection";
import { useToolCall } from "@/web/hooks/use-tool-call";
import { createToolCaller } from "@/tools/client";
import { MCPToolsGrid } from "./mcp-tools-grid";

interface StoreDiscoveryProps {
  registryId: string;
}

interface RegistryItem {
  id: string;
  name: string;
  description?: string;
}

export function StoreDiscovery({ registryId }: StoreDiscoveryProps) {
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<RegistryItem | null>(null);
  
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
  const { 
    data: listResults, 
    isLoading: isLoadingList, 
    error: listError 
  } = useToolCall({
    toolCaller,
    toolName: listToolName,
    toolInputParams: {},
    enabled: !!listToolName,
  });
  
  // Transform results to registry items
  const items = useMemo(() => {
    if (!listResults) return [];
    
    // Handle different response structures
    if (Array.isArray(listResults)) {
      return listResults.map((item: any, idx: number) => ({
        id: item.id || `item-${idx}`,
        name: item.name || item.title || `Item ${idx + 1}`,
        description: item.description || item.summary || undefined,
      }));
    }
    
    if (typeof listResults === "object" && listResults !== null) {
      const itemsKey = Object.keys(listResults).find(
        (key) => Array.isArray(listResults[key as keyof typeof listResults])
      );
      
      if (itemsKey) {
        const itemsArray = listResults[itemsKey as keyof typeof listResults] as any[];
        return itemsArray.map((item, idx) => ({
          id: item.id || `item-${idx}`,
          name: item.name || item.title || `Item ${idx + 1}`,
          description: item.description || item.summary || undefined,
        }));
      }
    }
    
    return [];
  }, [listResults]);

  // Featured items (first 3)
  const featuredItems = useMemo(() => {
    return items.slice(0, 3);
  }, [items]);

  // Filtered items based on search
  const filteredItems = useMemo(() => {
    if (!search) return items;

    const searchLower = search.toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(searchLower) ||
        (item.description?.toLowerCase() ?? "").includes(searchLower)
    );
  }, [items, search]);

  // Items for "All" section (excluding featured)
  const allItems = useMemo(() => {
    return filteredItems.filter(
      (item) => !featuredItems.find((f) => f.id === item.id)
    );
  }, [filteredItems, featuredItems]);

  // Search results (limited to 7)
  const searchResults = useMemo(() => {
    if (!search) return [];
    return filteredItems.slice(0, 7);
  }, [filteredItems, search]);

  const handleCardClick = (item: RegistryItem) => {
    setSelectedItem(item);
  };

  // Show selected item details when clicked
  if (selectedItem) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="shrink-0 bg-background border-b border-border p-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedItem(null)}
                className="h-10 w-10 rounded-lg hover:bg-muted flex items-center justify-center"
              >
                <Icon name="arrow_back" size={20} />
              </button>
              <div className="flex-1">
                <h1 className="text-lg font-medium">{selectedItem.name}</h1>
                {selectedItem.description && (
                  <p className="text-sm text-muted-foreground">
                    {selectedItem.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <div className="max-w-6xl mx-auto">
              <div className="bg-muted rounded-lg p-4">
                <pre className="text-xs overflow-x-auto">
                  {JSON.stringify(selectedItem, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoadingList) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground">Loading store items...</p>
      </div>
    );
  }

  // Error state
  if (listError) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Icon name="error" size={48} className="text-destructive mb-4" />
        <h3 className="text-lg font-medium mb-2">Error loading store</h3>
        <p className="text-muted-foreground max-w-md text-center">
          {listError instanceof Error ? listError.message : "Unknown error occurred"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header with search */}
      <div className="sticky top-0 z-20 bg-background border-b border-border p-4">
        <div className="max-w-6xl mx-auto">
          <div className="relative">
            <Icon
              name="search"
              size={20}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground pointer-events-none z-10"
            />
            <Input
              placeholder="Search items..."
              className="w-full pl-12"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && searchResults.length > 0 && (
              <div className="z-20 p-2 bg-popover w-full absolute left-0 top-[calc(100%+8px)] rounded-xl border border-border shadow-lg max-h-96 overflow-y-auto">
                {searchResults.map((item) => (
                  <div
                    key={item.id}
                    className="flex p-2 gap-2 cursor-pointer overflow-hidden items-center hover:bg-muted rounded-lg"
                    onClick={() => handleCardClick(item)}
                  >
                    <div className="h-8 w-8 rounded flex items-center justify-center bg-linear-to-br from-primary/20 to-primary/10 text-xs font-semibold text-primary shrink-0">
                      {item.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex flex-col gap-1 min-w-0">
                      <h3 className="text-sm font-semibold truncate">
                        {item.name}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.description || "No description"}
                      </p>
                    </div>
                  </div>
                ))}
                {searchResults.length === 0 && (
                  <div className="text-sm text-muted-foreground p-2">
                    No items found
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="max-w-6xl mx-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Icon name="inbox" size={48} className="text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No items available</h3>
                <p className="text-muted-foreground">
                  This store doesn't have any available items yet.
                </p>
              </div>
            ) : search && filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Icon name="search" size={48} className="text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No results found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your search terms.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                {featuredItems.length > 0 && (
                  <MCPToolsGrid
                    tools={featuredItems.map((item) => ({
                      id: item.id,
                      name: item.name,
                      description: item.description,
                    }))}
                    onCardClick={(tool) =>
                      handleCardClick(items.find((i) => i.id === tool.id)!)
                    }
                    title="Featured Items"
                    subtitle={`${featuredItems.length} available`}
                  />
                )}

                {allItems.length > 0 && (
                  <MCPToolsGrid
                    tools={allItems.map((item) => ({
                      id: item.id,
                      name: item.name,
                      description: item.description,
                    }))}
                    onCardClick={(tool) =>
                      handleCardClick(items.find((i) => i.id === tool.id)!)
                    }
                    title="All Items"
                    subtitle={`${allItems.length} available`}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


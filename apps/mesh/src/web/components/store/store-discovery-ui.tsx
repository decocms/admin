import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  RegistryItemsSection,
  type RegistryItem,
} from "./registry-items-section";
import { RegistryItemCard } from "./registry-item-card";

interface StoreDiscoveryUIProps {
  items: RegistryItem[];
  isLoading: boolean;
  error: Error | null;
  onItemClick: (item: RegistryItem) => void;
}

export function StoreDiscoveryUI({
  items,
  isLoading,
  error,
  onItemClick,
}: StoreDiscoveryUIProps) {
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<RegistryItem | null>(null);

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

  const handleItemClick = (item: RegistryItem) => {
    setSelectedItem(item);
    onItemClick(item);
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
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground">Loading store items...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Icon name="error" size={48} className="text-destructive mb-4" />
        <h3 className="text-lg font-medium mb-2">Error loading store</h3>
        <p className="text-muted-foreground max-w-md text-center">
          {error instanceof Error ? error.message : "Unknown error occurred"}
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
                  <RegistryItemCard
                    key={item.id}
                    {...item}
                    onClick={() => handleItemClick(item)}
                  />
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
                  <RegistryItemsSection
                    items={featuredItems}
                    title="Featured Items"
                    subtitle={`${featuredItems.length} available`}
                    onItemClick={handleItemClick}
                  />
                )}

                {allItems.length > 0 && (
                  <RegistryItemsSection
                    items={allItems}
                    title="All Items"
                    subtitle={`${allItems.length} available`}
                    onItemClick={handleItemClick}
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


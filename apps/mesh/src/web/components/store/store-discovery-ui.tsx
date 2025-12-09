import { useProjectContext } from "@/web/providers/project-context-provider";
import { slugify } from "@/web/utils/slugify";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { CollectionSearch } from "../collections/collection-search";
import {
  type RegistryItem,
  RegistryItemsSection,
} from "./registry-items-section";

interface StoreDiscoveryUIProps {
  items: RegistryItem[];
  isLoading: boolean;
  error: Error | null;
  registryId: string;
}

export function StoreDiscoveryUI({
  items,
  isLoading,
  error,
  registryId,
}: StoreDiscoveryUIProps) {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { org } = useProjectContext();

  // Filtered items based on search
  const filteredItems = !search
    ? items
    : (() => {
        const searchLower = search.toLowerCase();
        return items.filter(
          (item) =>
            (item.name || item.title || "")
              .toLowerCase()
              .includes(searchLower) ||
            (item.description || item.server?.description || "")
              .toLowerCase()
              .includes(searchLower),
        );
      })();

  // Verified items
  const verifiedItems = filteredItems.filter(
    (item) =>
      item.verified === true ||
      item._meta?.["mcp.mesh"]?.verified === true ||
      item.server?._meta?.["mcp.mesh"]?.verified === true,
  );

  // Non-verified items
  const allItems = filteredItems.filter(
    (item) => !verifiedItems.find((v) => v.id === item.id),
  );

  const handleItemClick = (item: RegistryItem) => {
    const itemName = item.name || item.title || item.server?.title || "";
    const appNameSlug = slugify(itemName);
    navigate({
      to: "/$org/store/$appName",
      params: { org, appName: appNameSlug },
      search: { registryId },
    });
  };
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

  // Main list view
  return (
    <div className="flex flex-col h-full">
      <CollectionSearch
        value={search}
        onChange={setSearch}
        placeholder="Search for a MCP..."
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setSearch(e.currentTarget.value);
          }
        }}
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-5">
          <div>
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Icon
                  name="inbox"
                  size={48}
                  className="text-muted-foreground mb-4"
                />
                <h3 className="text-lg font-medium mb-2">No items available</h3>
                <p className="text-muted-foreground">
                  This store doesn't have any available items yet.
                </p>
              </div>
            ) : search && filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Icon
                  name="search"
                  size={48}
                  className="text-muted-foreground mb-4"
                />
                <h3 className="text-lg font-medium mb-2">No results found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your search terms.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                {verifiedItems.length > 0 && (
                  <RegistryItemsSection
                    items={verifiedItems}
                    title="Verified"
                    onItemClick={handleItemClick}
                  />
                )}

                {allItems.length > 0 && (
                  <RegistryItemsSection
                    items={allItems}
                    title="All"
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

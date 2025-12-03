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
}

/** Helper to extract data from different JSON structures */
function extractItemData(item: RegistryItem) {
  const publisherMeta = item.server?._meta?.["io.decocms/publisher-provided"];
  const decoMeta = item._meta?.["io.decocms"];

  return {
    name: item.name || item.title || item.server?.title || "Unnamed Item",
    description:
      item.description || item.summary || item.server?.description || "",
    icon: item.icon || item.image || item.logo || item.server?.icons?.[0]?.src,
    verified: item.verified || decoMeta?.verified,
    publisher: item.publisher || decoMeta?.scopeName || "Unknown",
    tools: item.tools || item.server?.tools || publisherMeta?.tools || [],
    models: item.models || item.server?.models || publisherMeta?.models || [],
    emails: item.emails || item.server?.emails || publisherMeta?.emails || [],
    analytics:
      item.analytics || item.server?.analytics || publisherMeta?.analytics,
    cdn: item.cdn || item.server?.cdn || publisherMeta?.cdn,
  };
}

export function StoreDiscoveryUI({
  items,
  isLoading,
  error,
}: StoreDiscoveryUIProps) {
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<RegistryItem | null>(null);

  // Verified items
  const verifiedItems = useMemo(() => {
    return items.filter(
      (item) =>
        item.verified === true ||
        item._meta?.["io.decocms"]?.verified === true ||
        item.meta?.verified === true,
    );
  }, [items]);

  // Filtered items based on search
  const filteredItems = useMemo(() => {
    if (!search) return items;
    const searchLower = search.toLowerCase();
    return items.filter(
      (item) =>
        (item.name || item.title || "").toLowerCase().includes(searchLower) ||
        (item.description || item.server?.description || "")
          .toLowerCase()
          .includes(searchLower),
    );
  }, [items, search]);

  // Non-verified items
  const allItems = useMemo(() => {
    return filteredItems.filter(
      (item) => !verifiedItems.find((v) => v.id === item.id),
    );
  }, [filteredItems, verifiedItems]);

  // Search results (limited)
  const searchResults = useMemo(() => {
    if (!search) return [];
    return filteredItems.slice(0, 7);
  }, [filteredItems, search]);

  const handleItemClick = (item: RegistryItem) => {
    setSelectedItem(item);
  };

  // Detail view
  if (selectedItem) {
    const data = extractItemData(selectedItem);

    const availableTabs = [
      { id: "overview", label: "Overview", visible: true },
      { id: "tools", label: "Tools", visible: data.tools.length > 0 },
      { id: "models", label: "Models", visible: data.models.length > 0 },
      { id: "emails", label: "Emails", visible: data.emails.length > 0 },
      { id: "analytics", label: "Analytics", visible: !!data.analytics },
      { id: "cdn", label: "CDN", visible: !!data.cdn },
    ].filter((tab) => tab.visible);

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="shrink-0 bg-background border-b border-border px-4 py-3">
          <div className="max-w-4xl mx-auto">
            <button
              onClick={() => setSelectedItem(null)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Icon name="arrow_back" size={20} />
              Back
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-8">
            <div className="max-w-4xl mx-auto">
              {/* Hero */}
              <div className="flex items-start gap-6 mb-8">
                <div className="shrink-0 w-24 h-24 rounded-2xl bg-linear-to-br from-primary/20 to-primary/10 flex items-center justify-center text-3xl font-bold text-primary relative">
                  {data.icon ? (
                    <img
                      src={data.icon}
                      alt={data.name}
                      className="w-full h-full object-cover rounded-2xl"
                    />
                  ) : (
                    data.name.substring(0, 2).toUpperCase()
                  )}
                  {data.verified && (
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full border-2 border-background flex items-center justify-center">
                      <Icon name="check" size={16} className="text-white" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1 min-w-0">
                      <h1 className="text-2xl font-semibold mb-1">
                        {data.name}
                      </h1>
                      <p className="text-sm text-muted-foreground">
                        {data.verified && "✓ Verified • "}
                        {data.publisher}
                      </p>
                    </div>
                    <button className="shrink-0 px-6 py-2.5 bg-[#bef264] hover:bg-[#a3e635] text-black font-medium rounded-lg transition-colors flex items-center gap-2">
                      <Icon name="add" size={20} />
                      Install App
                    </button>
                  </div>
                  {data.description && (
                    <p className="text-muted-foreground mt-4">
                      {data.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Tabs */}
              {availableTabs.length > 1 && (
                <div className="border-b border-border mb-6">
                  <div className="flex gap-6">
                    {availableTabs.map((tab, idx) => (
                      <button
                        key={tab.id}
                        className={`px-1 py-3 border-b-2 text-sm font-medium ${
                          idx === 0
                            ? "border-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Content sections */}
              <div className="space-y-8">
                {data.description && (
                  <div>
                    <h2 className="text-lg font-medium mb-3">Overview</h2>
                    <p className="text-muted-foreground leading-relaxed">
                      {data.description}
                    </p>
                  </div>
                )}

                {data.tools.length > 0 && (
                  <div>
                    <h2 className="text-lg font-medium mb-3">Tools</h2>
                    <div className="space-y-2">
                      {(data.tools as Array<Record<string, unknown>>)
                        .slice(0, 5)
                        .map((tool: Record<string, unknown>, idx: number) => (
                          <div
                            key={(tool.id as string | number) || idx}
                            className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm">
                                {(tool.name as string) || `Tool ${idx + 1}`}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {(tool.description as string) ||
                                  "No description available"}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                <div>
                  <h2 className="text-lg font-medium mb-3">Publisher</h2>
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                    <div className="w-12 h-12 rounded-full bg-linear-to-br from-primary/20 to-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                      {data.publisher.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium">{data.publisher}</div>
                      <div className="text-xs text-muted-foreground">
                        {data.verified ? "Verified Publisher" : "Publisher"}
                      </div>
                    </div>
                  </div>
                </div>

                <details className="group">
                  <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                    View raw data
                  </summary>
                  <div className="mt-2 bg-muted rounded-lg p-4">
                    <pre className="text-xs overflow-x-auto">
                      {JSON.stringify(selectedItem, null, 2)}
                    </pre>
                  </div>
                </details>
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

  // Main list view
  return (
    <div className="flex flex-col h-full">
      {/* Search header */}
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
                    item={item}
                    onClick={() => handleItemClick(item)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="max-w-6xl mx-auto">
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
                    title="Verified by Deco"
                    subtitle={`${verifiedItems.length} verified`}
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

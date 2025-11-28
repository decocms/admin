/**
 * CollectionItemsList Component
 *
 * Displays items from a collection binding in a card/table layout.
 * Fetches items using the COLLECTION_{NAME}_LIST tool via the connection.
 */

import { createToolCaller } from "@/tools/client";
import type { BaseCollectionEntity } from "@decocms/bindings/collections";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Card } from "@deco/ui/components/card.tsx";
import { EmptyState } from "@deco/ui/components/empty-state.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { KEYS } from "../lib/query-keys";

interface CollectionItemsListProps {
  /** The connection ID to fetch items from */
  connectionId: string;
  /** The collection name (e.g., "LLM", "USER_PROFILES") */
  collectionName: string;
}

interface CollectionListResponse {
  items: BaseCollectionEntity[];
  totalCount?: number;
  hasMore?: boolean;
}

/**
 * Formats a collection name for display
 * e.g., "LLM" -> "Llm", "USER_PROFILES" -> "User Profiles"
 */
function formatCollectionName(name: string): string {
  return name
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function CollectionItemsList({
  connectionId,
  collectionName,
}: CollectionItemsListProps) {
  const [search, setSearch] = useState("");

  // Create tool caller for the specific connection
  const toolCaller = useMemo(
    () => createToolCaller(connectionId),
    [connectionId],
  );

  // Fetch collection items
  const { data, isLoading, isError, error } = useQuery({
    queryKey: KEYS.collectionItems(connectionId, collectionName),
    queryFn: async () => {
      const toolName = `COLLECTION_${collectionName}_LIST`;
      const result = await toolCaller(toolName, {});
      return result as CollectionListResponse;
    },
    staleTime: 30_000,
  });

  // Filter items by search
  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    if (!search.trim()) return data.items;

    const searchLower = search.toLowerCase();
    return data.items.filter((item) =>
      item.title.toLowerCase().includes(searchLower),
    );
  }, [data?.items, search]);

  const displayName = formatCollectionName(collectionName);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="border-destructive/30 bg-destructive/10">
        <div className="p-4 text-sm text-destructive">
          Failed to load {displayName}:{" "}
          {error instanceof Error ? error.message : "Unknown error"}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={`Search ${displayName.toLowerCase()}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Items */}
      {filteredItems.length === 0 ? (
        <EmptyState
          icon="box"
          title={`No ${displayName.toLowerCase()} found`}
          description={
            search
              ? "Try adjusting your search."
              : `This connection has no ${displayName.toLowerCase()}.`
          }
        />
      ) : (
        <ScrollArea className="h-[500px]">
          <div
            className="grid gap-4 pr-4"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            }}
          >
            {filteredItems.map((item) => (
              <CollectionItemCard key={item.id} item={item} />
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Total count */}
      {data?.totalCount !== undefined && (
        <div className="text-xs text-muted-foreground">
          Showing {filteredItems.length} of {data.totalCount} items
        </div>
      )}
    </div>
  );
}

interface CollectionItemCardProps {
  item: BaseCollectionEntity;
}

function CollectionItemCard({ item }: CollectionItemCardProps) {
  // Handle extended fields that might exist on items
  const extendedItem = item as BaseCollectionEntity & {
    description?: string | null;
    status?: string;
    logo?: string | null;
  };

  return (
    <Card className="p-4 rounded-xl border-border transition-colors hover:border-primary/50">
      <div className="flex flex-col gap-2">
        {/* Header with title and optional status */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {extendedItem.logo && (
              <img
                src={extendedItem.logo}
                alt=""
                className="h-6 w-6 rounded object-cover"
              />
            )}
            <div className="font-medium text-sm">{item.title}</div>
          </div>
          {extendedItem.status && (
            <Badge variant="secondary" className="text-xs">
              {extendedItem.status}
            </Badge>
          )}
        </div>

        {/* Description */}
        {extendedItem.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {extendedItem.description}
          </p>
        )}

        {/* Footer with ID and timestamp */}
        <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
          <span className="font-mono truncate max-w-[120px]" title={item.id}>
            {item.id}
          </span>
          {item.created_at && (
            <span>
              {formatDistanceToNow(new Date(item.created_at), {
                addSuffix: true,
              })}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

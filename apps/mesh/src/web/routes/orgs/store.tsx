import { EmptyState } from "@/web/components/empty-state";
import { StoreDiscovery } from "@/web/components/store";
import { useConnections } from "@/web/hooks/collections/use-connection";
import { useRegistryConnections } from "@/web/hooks/use-binding";
import { useMemo } from "react";

const DECO_STORE_URL = "https://api.decocms.com/mcp/registry";

export default function StorePage() {
  const { data: allConnections, isLoading, isError } = useConnections();

  // Filter to only show registry connections (those with collections)
  const registryConnections = useRegistryConnections(allConnections);

  // Find the Deco Store (default registry)
  const decoStore = useMemo(
    () =>
      registryConnections.find((c) => c.connection_url === DECO_STORE_URL) ||
      registryConnections[0],
    [registryConnections],
  );

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        Loading store...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="h-full flex items-center justify-center text-destructive">
        Failed to load store
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header Section - Title */}
      <div className="shrink-0 bg-background border-b border-border">
        <div className="px-4 py-3">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-base font-light tracking-tight">Store</h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="h-full flex flex-col overflow-hidden">
        {decoStore ? (
          <StoreDiscovery registryId={decoStore.id} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <EmptyState
              image={
                <img
                  src="/store-empty-state.svg"
                  alt="No store available"
                  width={423}
                  height={279}
                  className="max-w-full h-auto"
                />
              }
              title="No store available"
              description="The Deco Store is being set up for your organization."
            />
          </div>
        )}
      </div>
    </div>
  );
}

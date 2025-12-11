import { createToolCaller } from "@/tools/client";
import { ErrorBoundary } from "@/web/components/error-boundary";
import { getCollection, useCollectionList } from "@/web/hooks/use-collections";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Loader2 } from "lucide-react";
import { Suspense } from "react";
import type { RegistryItem } from "./registry-items-section";
import { StoreDiscoveryUI } from "./store-discovery-ui";

interface StoreDiscoveryProps {
  registryId: string;
}

function StoreDiscoveryContent({ registryId }: StoreDiscoveryProps) {
  const toolCaller = createToolCaller(registryId);
  const collection = getCollection(registryId, "REGISTRY_APP", toolCaller);
  const items = useCollectionList(collection) as RegistryItem[];

  return <StoreDiscoveryUI items={items} registryId={registryId} />;
}

export function StoreDiscovery({ registryId }: StoreDiscoveryProps) {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex flex-col items-center justify-center h-full">
          <Icon name="error" size={48} className="text-destructive mb-4" />
          <h3 className="text-lg font-medium mb-2">Error loading store</h3>
          <p className="text-muted-foreground max-w-md text-center">
            Failed to load store items. Please try again.
          </p>
        </div>
      }
    >
      <Suspense
        fallback={
          <div className="flex flex-col items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              Loading store items...
            </p>
          </div>
        }
      >
        <StoreDiscoveryContent registryId={registryId} />
      </Suspense>
    </ErrorBoundary>
  );
}

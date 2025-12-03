import { StoreRegistrySelect } from "@/web/components/store-registry-select";
import { EmptyState } from "@/web/components/empty-state";
import { StoreDiscovery } from "@/web/components/store";
import { useConnections } from "@/web/hooks/collections/use-connection";
import { useProjectContext } from "@/web/providers/project-context-provider";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";

export default function StorePage() {
  const { org } = useProjectContext();
  const navigate = useNavigate();
  const [selectedRegistry, setSelectedRegistry] = useState<string>("");
  const { data: connections, isLoading, isError } = useConnections();

  const registryOptions = useMemo(
    () =>
      (connections ?? []).map((c) => ({
        id: c.id,
        name: c.title,
        icon: c.icon || undefined,
      })),
    [connections],
  );

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        Loading stores...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="h-full flex items-center justify-center text-destructive">
        Failed to load stores
      </div>
    );
  }

  const safeConnections = connections ?? [];
  const effectiveRegistry = selectedRegistry || safeConnections[0]?.id || "";

  const handleAddNewRegistry = () => {
    navigate({
      to: "/$org/mcps",
      params: { org },
      search: { action: "create" },
    });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header Section - Title and Registry Select */}
      <div className="shrink-0 bg-background border-b border-border">
        <div className="px-4 py-3">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between ">
              <div>
                <h1 className="text-base font-light tracking-tight">Store</h1>
              </div>
              <div className="shrink-0">
                <StoreRegistrySelect
                  registries={registryOptions}
                  value={effectiveRegistry}
                  onValueChange={setSelectedRegistry}
                  onAddNew={handleAddNewRegistry}
                  placeholder="Select store..."
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="h-full flex flex-col overflow-hidden">
        {effectiveRegistry ? (
          <StoreDiscovery registryId={effectiveRegistry} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <EmptyState
              image={
                <img
                  src="/store-empty-state.svg"
                  alt="No store connected"
                  width={423}
                  height={279}
                  className="max-w-full h-auto"
                />
              }
              title="No store connected"
              description="Connect to a store to discover and install MCPs from the community."
              actions={
                <StoreRegistrySelect
                  registries={registryOptions}
                  value={effectiveRegistry}
                  onValueChange={setSelectedRegistry}
                  onAddNew={handleAddNewRegistry}
                  placeholder="Select store..."
                />
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}

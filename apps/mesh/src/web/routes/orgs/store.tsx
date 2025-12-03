import { StoreRegistrySelect } from "@/web/components/store-registry-select";
import { EmptyState } from "@/web/components/empty-state";
import { StoreDiscovery } from "@/web/components/store";
import { useConnections } from "@/web/hooks/collections/use-connection";
import { useProjectContext } from "@/web/providers/project-context-provider";
import { useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";

export default function StorePage() {
  const { org } = useProjectContext();
  const navigate = useNavigate();
  const [selectedRegistry, setSelectedRegistry] = useState<string>("");
  const { data: connections = [] } = useConnections();

  // Auto-select if only one registry exists
  useEffect(() => {
    const firstConnection = connections[0];
    if (connections.length === 1 && !selectedRegistry && firstConnection) {
      setSelectedRegistry(firstConnection.id);
    }
  }, [connections, selectedRegistry]);

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
                  registries={connections.map((c) => ({
                    id: c.id,
                    name: c.title,
                    icon: c.icon || undefined,
                  }))}
                  value={selectedRegistry}
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
        {selectedRegistry ? (
          <StoreDiscovery registryId={selectedRegistry} />
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
                  registries={connections.map((c) => ({
                    id: c.id,
                    name: c.title,
                    icon: c.icon || undefined,
                  }))}
                  value={selectedRegistry}
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


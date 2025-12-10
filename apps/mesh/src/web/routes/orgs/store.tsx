import { StoreRegistrySelect } from "@/web/components/store-registry-select";
import { EmptyState } from "@/web/components/empty-state";
import { StoreDiscovery } from "@/web/components/store";
import { useConnections } from "@/web/hooks/collections/use-connection";
import { useRegistryConnections } from "@/web/hooks/use-binding";
import { useProjectContext } from "@/web/providers/project-context-provider";
import { useNavigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { CollectionHeader } from "@/web/components/collections/collection-header";

export default function StorePage() {
  const { org } = useProjectContext();
  const navigate = useNavigate();
  const [selectedRegistry, setSelectedRegistry] = useState<string>("");
  const allConnections = useConnections();

  // Check if we're viewing a child route (app detail)
  const routerState = useRouterState();
  const isViewingAppDetail =
    routerState.location.pathname.includes("/store/") &&
    routerState.location.pathname.split("/").length > 3;

  // Filter to only show registry connections (those with collections)
  const registryConnections = useRegistryConnections(allConnections);

  const registryOptions = registryConnections.map((c) => ({
    id: c.id,
    name: c.title,
    icon: c.icon || undefined,
  }));

  const effectiveRegistry =
    selectedRegistry || registryConnections[0]?.id || "";

  const handleAddNewRegistry = () => {
    navigate({
      to: "/$org/mcps",
      params: { org: org.slug },
      search: { action: "create" },
    });
  };

  // If we're viewing an app detail (child route), render the Outlet
  if (isViewingAppDetail) {
    return <Outlet />;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <CollectionHeader
        title="Store"
        ctaButton={
          <StoreRegistrySelect
            registries={registryOptions}
            value={effectiveRegistry}
            onValueChange={setSelectedRegistry}
            onAddNew={handleAddNewRegistry}
            placeholder="Select store..."
          />
        }
      />

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

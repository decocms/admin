import { StoreRegistrySelect } from "@/web/components/store-registry-select";
import { EmptyState } from "@/web/components/empty-state";
import { StoreDiscovery } from "@/web/components/store";
import { useConnections } from "@/web/hooks/collections/use-connection";
import { useRegistryConnections } from "@/web/hooks/use-binding";
import { useProjectContext } from "@/web/providers/project-context-provider";
import { useNavigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { CollectionHeader } from "@/web/components/collections/collection-header";
import { useLocalStorage } from "@/web/hooks/use-local-storage";
import { LOCALSTORAGE_KEYS } from "@/web/lib/localstorage-keys";

export default function StorePage() {
  const { org } = useProjectContext();
  const navigate = useNavigate();
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

  // Persist selected registry in localStorage (scoped by org)
  const [selectedRegistry, setSelectedRegistry] = useLocalStorage<string>(
    LOCALSTORAGE_KEYS.selectedRegistry(org),
    "",
  );

  // Update selected registry when registry connections change
  // If the saved registry is no longer available, fallback to first available
  useEffect(() => {
    if (registryConnections.length > 0) {
      const savedRegistryExists = selectedRegistry
        ? registryConnections.some((c) => c.id === selectedRegistry)
        : false;

      if (!savedRegistryExists) {
        // If saved registry doesn't exist or is empty, use first available
        const firstRegistryId = registryConnections[0]?.id || "";
        if (firstRegistryId && firstRegistryId !== selectedRegistry) {
          setSelectedRegistry(firstRegistryId);
        }
      }
    }
  }, [registryConnections, selectedRegistry, setSelectedRegistry]);

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

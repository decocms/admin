import {
  type Integration,
  useInstallFromMarketplace,
  useMarketplaceIntegrations,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { type ChangeEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useBasePath } from "../../../hooks/useBasePath.ts";
import { IntegrationPage } from "./breadcrumb.tsx";

// Marketplace Integration type that matches the structure from the API
interface MarketplaceIntegration extends Integration {
  provider: string;
}

// Available Integration Card Component
function AvailableIntegrationCard({
  integration,
}: { integration: MarketplaceIntegration }) {
  const {
    mutate: installIntegration,
    isPending: isInstalling,
  } = useInstallFromMarketplace();
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdIntegrationId, setCreatedIntegrationId] = useState<
    string | null
  >(null);
  const navigate = useNavigate();
  const withBasePath = useBasePath();

  const isPending = isInstalling;

  const handleInstall = () => {
    installIntegration(integration.id, {
      onSuccess: (data) => {
        if (typeof data.installationId !== "string") {
          setError("Failed to install integration: Invalid installation data");
          return;
        }
        setShowModal(true);
        setCreatedIntegrationId(data.installationId);
      },
      onError: (error) => {
        setError(
          error instanceof Error
            ? error.message
            : "Failed to install integration",
        );
        setShowModal(true);
      },
    });
  };

  const handleEditIntegration = () => {
    if (!createdIntegrationId) return;
    navigate(withBasePath(`/integration/${createdIntegrationId}`));
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setError(null);
    setCreatedIntegrationId(null);
  };

  return (
    <>
      <Card
        className="shadow-sm group hover:shadow-md transition-shadow rounded-2xl cursor-pointer"
        onClick={() => setShowModal(true)}
      >
        <CardContent className="p-4">
          <div className="grid grid-cols-[min-content_1fr] gap-4">
            <div className="h-16 w-16 rounded-md flex items-center justify-center overflow-hidden">
              <img
                src={integration.icon}
                alt={`${integration.name} icon`}
                className="h-full w-full object-contain"
              />
            </div>

            <div className="grid grid-cols-1 gap-1">
              <div className="text-base font-semibold truncate">
                {integration.name}
              </div>
              <div className="text-sm text-muted-foreground line-clamp-2">
                {integration.description}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <span className="text-xs px-2 py-1 bg-secondary rounded-full">
              {integration.provider}
            </span>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={handleCloseModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {error ? "Installation Failed" : `Connect to ${integration.name}`}
            </DialogTitle>
            <DialogDescription>
              {error
                ? <div className="text-destructive">{error}</div>
                : (
                  <div className="mt-4">
                    <div className="grid grid-cols-[80px_1fr] items-center gap-4">
                      <div className="rounded-md flex items-center justify-center overflow-hidden">
                        <img
                          src={integration.icon}
                          alt={`${integration.name} icon`}
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">
                          {integration.description}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {error
              ? <Button onClick={handleCloseModal}>Close</Button>
              : isPending
              ? (
                <Button disabled={isPending}>
                  Connecting...
                </Button>
              )
              : createdIntegrationId
              ? (
                <Button onClick={handleEditIntegration}>
                  See Integration
                </Button>
              )
              : (
                <Button onClick={handleInstall}>
                  Connect
                </Button>
              )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function Marketplace() {
  const [registryFilter, setRegistryFilter] = useState("");

  // Use the marketplace integrations hook instead of static registry
  const { data: marketplace } = useMarketplaceIntegrations();

  // Filter marketplace integrations by name, description, and provider
  const filteredRegistryIntegrations = useMemo(() => {
    const searchTerm = registryFilter.toLowerCase();

    return registryFilter
      ? marketplace.integrations.filter((integration) =>
        integration.name.toLowerCase().includes(searchTerm) ||
        (integration.description?.toLowerCase() ?? "").includes(searchTerm) ||
        integration.provider.toLowerCase().includes(searchTerm)
      )
      : marketplace.integrations;
  }, [marketplace, registryFilter]);

  return (
    <IntegrationPage>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4">
          <Input
            placeholder="Filter integrations..."
            className="max-w-[373px] rounded-[46px]"
            value={registryFilter}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setRegistryFilter(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
          {filteredRegistryIntegrations.map((integration) => (
            <AvailableIntegrationCard
              key={integration.id}
              integration={integration}
            />
          ))}
        </div>
      </div>
    </IntegrationPage>
  );
}

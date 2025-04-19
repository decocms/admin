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
import { trackEvent } from "../../../hooks/analytics.ts";
import { useBasePath } from "../../../hooks/useBasePath.ts";
import { useFocusAgent } from "../../agents/hooks.ts";
import { IntegrationPage } from "./breadcrumb.tsx";
import { IntegrationIcon } from "./common.tsx";
import { useCreateExplorerAgent } from "./useCreateExplorerAgent.ts";

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
  const focusAgent = useFocusAgent();
  const [showModal, setShowModal] = useState(false);
  const [createdIntegrationId, setCreatedIntegrationId] = useState<
    string | null
  >(null);
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);
  const navigate = useNavigate();
  const withBasePath = useBasePath();

  // Use the custom hook for agent creation
  const { createExplorerAgent, isCreatingAgent, error } =
    useCreateExplorerAgent();

  const isPending = isInstalling || isCreatingAgent;

  const handleInstall = () => {
    installIntegration(integration.id, {
      onSuccess: async (data) => {
        if (typeof data.installationId !== "string") {
          // Handle error
          return;
        }

        const installationId = data.installationId;
        setShowModal(true);
        setCreatedIntegrationId(installationId);
        trackEvent("integration_install", {
          success: true,
          data: integration,
        });

        // Use the hook's createExplorerAgent function
        const agentId = await createExplorerAgent(installationId);
        if (agentId) {
          setCreatedAgentId(agentId);
        }
      },
      onError: (error) => {
        setShowModal(true);

        trackEvent("integration_install", {
          success: false,
          data: integration,
          error,
        });
      },
    });
  };

  const handleEditIntegration = () => {
    if (!createdIntegrationId) return;
    navigate(withBasePath(`/integration/${createdIntegrationId}`));
  };

  const handleExploreIntegration = () => {
    if (!createdAgentId) return;
    focusAgent(createdAgentId, {
      message: `I want to configure and explore ${integration.name}`,
    });
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setCreatedIntegrationId(null);
    setCreatedAgentId(null);
  };

  return (
    <>
      <Card
        className="group hover:shadow-md transition-shadow rounded-2xl cursor-pointer"
        onClick={() => setShowModal(true)}
      >
        <CardContent className="p-4">
          <div className="grid grid-cols-[min-content_1fr] gap-4">
            <IntegrationIcon
              icon={integration.icon}
              name={integration.name}
              className="h-16 w-16"
            />

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
                      <IntegrationIcon
                        icon={integration.icon}
                        name={integration.name}
                      />
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
                  {isCreatingAgent ? "Creating Agent..." : "Connecting..."}
                </Button>
              )
              : createdIntegrationId
              ? (
                <div className="flex gap-3">
                  <Button
                    onClick={handleEditIntegration}
                    disabled={!createdAgentId}
                  >
                    Inspect
                  </Button>
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={handleExploreIntegration}
                    disabled={!createdAgentId}
                  >
                    Explore
                  </Button>
                </div>
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
      ? marketplace.integrations.filter((integration: MarketplaceIntegration) =>
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

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-4">
          {filteredRegistryIntegrations.map((
            integration: MarketplaceIntegration,
          ) => (
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

import {
  type MCPRegistryServer,
  useMCPRegistryMarketplace,
  type MarketplaceIntegrationCompat,
  toDeskCompatibleMarketplaceIntegration,
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
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { useMemo } from "react";
import { IntegrationIcon } from "./common.tsx";

// Export for compatibility with existing code
export type MarketplaceIntegration = MarketplaceIntegrationCompat;

interface ConnectIntegrationModalProps {
  open: boolean;
  integration: MarketplaceIntegration | null;
  createdIntegrationId: string | null;
  loading: boolean;
  onConnect: () => void;
  onEdit: () => void;
  onClose: () => void;
}

export function SetupIntegrationModal({
  open,
  integration,
  createdIntegrationId,
  loading,
  onConnect,
  onEdit,
  onClose,
}: ConnectIntegrationModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Connect to {integration?.name}
          </DialogTitle>
          <DialogDescription>
            <div className="mt-4">
              <div className="grid grid-cols-[80px_1fr] items-start gap-4">
                <IntegrationIcon
                  icon={integration?.icon}
                  name={integration?.name}
                />
                <div>
                  <div className="text-sm text-muted-foreground">
                    {integration?.description}
                  </div>
                  {createdIntegrationId && (
                    <div className="font-bold mt-4">
                      The integration has been installed successfully. Click the
                      button below to configure it.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          {loading ? (
            <Button disabled={loading}>Connecting...</Button>
          ) : createdIntegrationId ? (
            <div className="flex gap-3">
              <Button onClick={onEdit}>Configure</Button>
            </div>
          ) : (
            <Button onClick={onConnect}>Connect</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function VerifiedBadge() {
  return (
    <div className="relative w-4 h-4">
      <div className="absolute bg-primary rounded-full w-2 h-2 top-1 left-1" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Icon
            name="verified"
            size={16}
            className="absolute z-10 text-primary"
            filled
          />
        </TooltipTrigger>
        <TooltipContent>
          <p>Made by Deco</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function CardsView({
  servers,
  onRowClick,
}: {
  servers: MarketplaceIntegration[];
  onRowClick: (server: MarketplaceIntegration) => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
      {servers.map((server) => {
        const showVerifiedBadge =
          server.id !== NEW_CUSTOM_CONNECTION.id && server.verified;
        return (
          <Card
            key={server.id}
            className="group hover:shadow-md transition-shadow rounded-2xl cursor-pointer h-[116px]"
            onClick={() => onRowClick(server)}
          >
            <CardContent className="p-4">
              <div className="grid grid-cols-[min-content_1fr] gap-4">
                <IntegrationIcon
                  icon={server.icon}
                  name={server.friendlyName || server.name}
                  className="h-10 w-10"
                />
                <div className="grid grid-cols-1 gap-1">
                  <div className="flex items-start gap-1">
                    <div className="text-sm font-semibold truncate">
                      {server.friendlyName || server.name}
                    </div>
                    {showVerifiedBadge && <VerifiedBadge />}
                  </div>
                  <div className="text-sm text-muted-foreground line-clamp-3">
                    {server.description}
                  </div>
                  {/* Mostrar tags se disponível */}
                  {server.tags && server.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap mt-1">
                      {server.tags
                        .filter((tag) => tag !== "verified" && tag !== "deco")
                        .slice(0, 2)
                        .map((tag) => (
                          <span
                            key={tag}
                            className="text-xs bg-secondary px-2 py-0.5 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export const NEW_CUSTOM_CONNECTION: MarketplaceIntegration = {
  id: "NEW_CUSTOM_CONNECTION",
  name: "Create custom integration",
  description: "Create a new integration with any MCP server",
  icon: "",
  author: { name: "deco" },
  verified: true,
  capabilities: [],
  tags: ["custom"],
  provider: "deco",
  friendlyName: "Create custom integration",
};

export function Marketplace({
  filter,
  onClick,
  emptyState,
}: {
  filter: string;
  onClick: (server: MarketplaceIntegration) => void;
  emptyState?: React.ReactNode;
}) {
  const { data: marketplace } = useMCPRegistryMarketplace();

  const filteredServers = useMemo(() => {
    const searchTerm = filter.toLowerCase();
    // Converter para formato compatível com código antigo
    const compatServers: MarketplaceIntegration[] = [
      NEW_CUSTOM_CONNECTION,
      ...(marketplace?.servers?.map(toDeskCompatibleMarketplaceIntegration) ??
        []),
    ];

    return filter
      ? compatServers.filter(
          (server: MarketplaceIntegration) =>
            server.name.toLowerCase().includes(searchTerm) ||
            (server.description?.toLowerCase() ?? "").includes(
              searchTerm,
            ) ||
            (server.provider?.toLowerCase() ?? "").includes(
              searchTerm,
            ) ||
            (server.friendlyName?.toLowerCase() ?? "").includes(
              searchTerm,
            ) ||
            server.tags?.some((tag) =>
              tag.toLowerCase().includes(searchTerm),
            ),
        )
      : compatServers;
  }, [marketplace, filter]);

  if (filteredServers.length === 0 && emptyState) {
    return emptyState;
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex-1 min-h-0 overflow-x-auto">
        <CardsView servers={filteredServers} onRowClick={onClick} />
      </div>
    </div>
  );
}

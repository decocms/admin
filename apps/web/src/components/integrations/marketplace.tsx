import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { useMemo } from "react";
import { useMarketplaceSpec } from "../../hooks/use-marketplace-spec.ts";
import {
  type MarketplaceIntegration,
  getVerified,
  getTags,
  getIconUrl,
} from "./marketplace-adapter.ts";
import { IntegrationIcon } from "./common.tsx";

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
  integrations,
  onRowClick,
}: {
  integrations: MarketplaceIntegration[];
  onRowClick: (integration: MarketplaceIntegration) => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
      {integrations.map((integration) => {
        const showVerifiedBadge =
          integration.id !== NEW_CUSTOM_CONNECTION.id &&
          getVerified(integration);
        return (
          <Card
            key={integration.id}
            className="group hover:shadow-md transition-shadow rounded-2xl cursor-pointer h-[116px]"
            onClick={() => onRowClick(integration)}
          >
            <CardContent className="p-4">
              <div className="grid grid-cols-[min-content_1fr] gap-4">
                <IntegrationIcon
                  icon={getIconUrl(integration)}
                  name={integration.title || integration.name}
                  className="h-10 w-10"
                />
                <div className="grid grid-cols-1 gap-1">
                  <div className="flex items-start gap-1">
                    <div className="text-sm font-semibold truncate">
                      {integration.title || integration.name}
                    </div>
                    {showVerifiedBadge && <VerifiedBadge />}
                  </div>
                  <div className="text-sm text-muted-foreground line-clamp-3">
                    {integration.description}
                  </div>
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
  name: "custom",
  title: "Create custom integration",
  description: "Create a new integration with any MCP server",
  icons: undefined,
  _meta: {
    "deco/internal": {
      status: "active",
      verified: false,
      connection: { type: "HTTP", url: "" },
    },
  },
};

export function Marketplace({
  filter,
  onClick,
  emptyState,
}: {
  filter: string;
  onClick: (integration: MarketplaceIntegration) => void;
  emptyState?: React.ReactNode;
}) {
  const { data: marketplace } = useMarketplaceSpec();

  const filteredIntegrations = useMemo(() => {
    const searchTerm = filter.toLowerCase();
    const integrations = [
      NEW_CUSTOM_CONNECTION,
      ...(marketplace?.integrations ?? []),
    ];

    return filter
      ? integrations.filter(
          (integration: MarketplaceIntegration) =>
            integration.name.toLowerCase().includes(searchTerm) ||
            (integration.description?.toLowerCase() ?? "").includes(
              searchTerm,
            ) ||
            getTags(integration).some((tag: string) =>
              tag.toLowerCase().includes(searchTerm),
            ),
        )
      : integrations;
  }, [marketplace, filter]);

  if (filteredIntegrations.length === 0 && emptyState) {
    return emptyState;
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex-1 min-h-0 overflow-x-auto">
        <CardsView integrations={filteredIntegrations} onRowClick={onClick} />
      </div>
    </div>
  );
}

export type {
  MarketplaceIntegration,
  MarketplaceIntegrationCompat,
} from "./marketplace-adapter.ts";

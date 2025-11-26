import { type Integration } from "@deco/sdk";
import { useMarketplaceSpec } from "../../hooks/use-marketplace-spec.ts";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { useEffect, useMemo, useState } from "react";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { IntegrationAvatar } from "../common/avatar/integration.tsx";
import { AppKeys } from "../integrations/apps.ts";
import { getMarketplaceAppKey } from "../integrations/marketplace-adapter.ts";
import { VerifiedBadge } from "../integrations/marketplace.tsx";
import {
  type MarketplaceIntegration,
  getVerified,
  getIconUrl,
  getBannerUrl,
  getTags,
} from "../integrations/marketplace-adapter.ts";

// For the future, it should be controlled in a view
const HIGHLIGHTS = [
  {
    name: "@deco/google-sheets",
    title: "Google Sheets",
    description: "Manage spreadsheets with structured data",
    _meta: {
      "deco/internal": {
        banner:
          "https://assets.decocache.com/decocms/3cbf2b30-57aa-47a3-89c5-9277a6b8c993/googlesheets.png",
      },
    },
  },
];

// For the future, it should be controlled in a view
const FEATURED = ["@deco/airtable", "@deco/slack", "@deco/google-docs"];

/**
 * Filter apps that have valid icons (not empty and not default).
 * Remove apps without icon and apps with default icon that ends with /app.png
 */
const hasValidIcon = (integration: MarketplaceIntegration): boolean => {
  const iconUrl = getIconUrl(integration);
  if (!iconUrl || iconUrl.trim() === "") return false;
  return !iconUrl.endsWith("/app.png");
};

/**
 * Return the most recent app names based on marketplace order.
 * The apps from the marketplace already come ordered by creation date (most recent first).
 * Filter only apps with valid icons.
 */
const getRecentApps = (
  integrations: Integration[] | undefined,
  limit = 3,
): string[] => {
  if (!integrations || integrations.length === 0) return FEATURED;

  const appsWithValidIcons = integrations.filter(hasValidIcon);
  const appsWithCreatedAt = appsWithValidIcons.filter(
    (integration) => integration.createdAt,
  );

  return appsWithCreatedAt.length === 0
    ? FEATURED
    : appsWithCreatedAt.slice(0, limit).map((integration) => integration.name);
};

// FeaturedIntegration agora usa _meta["deco/internal"].banner
type FeaturedIntegration = MarketplaceIntegration;

const handleCardClick = (
  appKey: string,
  onAppClick?: (appKey: string) => void,
  navigateWorkspace?: (path: string) => void,
) => {
  if (onAppClick) {
    onAppClick(appKey);
  } else if (navigateWorkspace) {
    navigateWorkspace(`/apps/${appKey}`);
  }
};

const FeaturedCard = ({
  integration,
  onAppClick,
}: {
  integration: FeaturedIntegration;
  onAppClick?: (appKey: string) => void;
}) => {
  const navigateWorkspace = useNavigateWorkspace();
  const appKeyData = getMarketplaceAppKey(integration);
  const appKey = AppKeys.build(appKeyData);

  const handleClick = () => {
    handleCardClick(appKey, onAppClick, navigateWorkspace);
  };

  return (
    <div
      onClick={handleClick}
      className="flex flex-col gap-2 p-4 bg-card rounded-xl cursor-pointer overflow-hidden hover:shadow-md transition-shadow"
    >
      <IntegrationAvatar
        url={getIconUrl(integration)}
        fallback={integration.title || integration.name}
        size="lg"
      />
      <h3 className="text-sm flex gap-1 items-center">
        {integration.title || integration.name}
        {getVerified(integration) && <VerifiedBadge />}
      </h3>
      <p className="text-sm text-muted-foreground line-clamp-2">
        {integration.description}
      </p>
    </div>
  );
};

const SimpleFeaturedCard = ({
  integration,
  onAppClick,
}: {
  integration: FeaturedIntegration;
  onAppClick?: (appKey: string) => void;
}) => {
  const navigateWorkspace = useNavigateWorkspace();
  const appKey = AppKeys.build(getMarketplaceAppKey(integration));

  return (
    <div
      onClick={() => handleCardClick(appKey, onAppClick, navigateWorkspace)}
      className="flex gap-2 p-2 items-center cursor-pointer rounded-lg hover:bg-muted transition-colors"
    >
      <IntegrationAvatar
        url={getIconUrl(integration)}
        fallback={integration.title || integration.name}
        size="lg"
      />
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <h3 className="text-sm font-medium truncate">
          {integration.title || integration.name}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-1">
          {integration.description}
        </p>
      </div>
    </div>
  );
};

function Discover(props: { onAppClick?: (appKey: string) => void } = {}) {
  const { onAppClick } = props;
  const [search, setSearch] = useState("");
  const { data: integrations } = useMarketplaceSpec();
  const navigateWorkspace = useNavigateWorkspace();

  const recentApps = useMemo(
    () =>
      getRecentApps(integrations?.integrations as Integration[] | undefined, 3),
    [integrations],
  );

  const featuredIntegrations = integrations?.integrations.filter(
    (integration) => recentApps.includes(integration.name),
  );
  const verifiedIntegrations = integrations?.integrations.filter(
    (integration) => getVerified(integration),
  );

  const sortedIntegrations = useMemo<FeaturedIntegration[]>(() => {
    if (!integrations?.integrations) return [];

    const appsWithIcons = integrations.integrations.filter((app) =>
      hasValidIcon(app),
    );
    const appsWithoutIcons = integrations.integrations.filter(
      (app) => !hasValidIcon(app),
    );

    return [...appsWithIcons, ...appsWithoutIcons]
      .sort((a, b) => {
        const aVerified = getVerified(a);
        const bVerified = getVerified(b);
        if (aVerified && !bVerified) return -1;
        if (!aVerified && bVerified) return 1;
        return 0;
      })
      .map((integration) => integration as FeaturedIntegration);
  }, [integrations]);

  const highlights = useMemo(() => {
    return HIGHLIGHTS.map((highlight) => {
      const integration = integrations?.integrations.find(
        (integration) => integration.name === highlight.name,
      );
      if (!integration) {
        return highlight as MarketplaceIntegration;
      }
      const bannerUrl = highlight._meta?.["deco/internal"]?.banner;
      return {
        ...integration,
        _meta: {
          ...integration._meta,
          "deco/internal": {
            ...integration._meta?.["deco/internal"],
            banner: bannerUrl,
          },
        },
      } as MarketplaceIntegration;
    });
  }, [integrations]);

  const filteredIntegrations = useMemo(() => {
    return integrations?.integrations
      ?.filter(
        (integration) =>
          integration.name.toLowerCase().includes(search.toLowerCase()) ||
          getTags(integration).some((tag: string) =>
            tag.toLowerCase().includes(search.toLowerCase()),
          ),
      )
      ?.slice(0, 7);
  }, [integrations, search]);

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-background p-4">
        <div className="flex justify-between items-center">
          <div className="relative">
            <Icon
              name="search"
              size={20}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground pointer-events-none z-10"
            />
            <Input
              placeholder="Search"
              className="w-[370px] pl-12"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <div className="z-20 p-2 bg-popover w-[370px] absolute left-0 top-[calc(100%+8px)] rounded-xl border border-border shadow-lg">
                {filteredIntegrations?.map((integration) => (
                  <SimpleFeaturedCard
                    key={"search-" + integration.id}
                    integration={integration}
                    onAppClick={onAppClick}
                  />
                ))}
                {filteredIntegrations?.length === 0 && (
                  <div className="text-sm text-muted-foreground">
                    No integrations found
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable content with independent columns */}
      <div className="flex-1 p-4 grid grid-cols-6 gap-8 overflow-hidden">
        {/* Left column - main content with independent scroll */}
        <div className="col-span-4 overflow-y-auto">
          <div className="flex flex-col gap-4">
            {highlights.map((item) => {
              if (!item.id) return null;

              const marketplaceItem = item as MarketplaceIntegration;
              const appKey = AppKeys.build(
                getMarketplaceAppKey(marketplaceItem),
              );
              const displayName = marketplaceItem.title || marketplaceItem.name;

              const handleKeyDown = (e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleCardClick(appKey, onAppClick, navigateWorkspace);
                }
              };

              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() =>
                    handleCardClick(appKey, onAppClick, navigateWorkspace)
                  }
                  onKeyDown={handleKeyDown}
                  className="relative rounded-xl overflow-hidden group cursor-pointer transition-transform hover:scale-105"
                >
                  <img
                    src={getBannerUrl(item) || ""}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute flex flex-col bottom-6 left-6">
                    <IntegrationAvatar
                      url={getIconUrl(item)}
                      fallback={displayName}
                      size="lg"
                      className="border-none mb-2"
                    />
                    <h3 className="flex gap-2 items-center text-3xl font-bold text-white mb-0.5">
                      {displayName}
                      {getVerified(item) && <VerifiedBadge />}
                    </h3>
                    <p className="text-sm text-white/90 line-clamp-2">
                      {item.description}
                    </p>
                  </div>
                  <Button
                    className="absolute bottom-6 right-6 group-hover:scale-105 transition-transform"
                    variant="default"
                  >
                    See app
                  </Button>
                </button>
              );
            })}

            <h2 className="text-lg pt-5 font-medium">
              Featured Apps
              <span className="text-muted-foreground font-mono font-normal text-sm ml-2">
                {featuredIntegrations?.length}
              </span>
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {featuredIntegrations?.map((integration) => (
                <FeaturedCard
                  key={integration.id}
                  integration={integration}
                  onAppClick={onAppClick}
                />
              ))}
            </div>

            <h2 className="text-lg pt-5 font-medium">
              All Apps
              <span className="text-muted-foreground font-mono font-normal text-sm ml-2">
                {sortedIntegrations.length}
              </span>
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {sortedIntegrations.map((integration) => (
                <FeaturedCard
                  key={integration.id}
                  integration={integration}
                  onAppClick={onAppClick}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right column - verified apps with independent scroll */}
        <div className="col-span-2 overflow-y-auto">
          <div className="flex flex-col gap-2">
            <div className="sticky top-0 bg-background z-10 pb-2">
              <h2 className="text-muted-foreground text-sm font-mono">
                VERIFIED BY DECO
              </h2>
            </div>
            <div className="grid gap-2">
              {verifiedIntegrations?.map((integration) => (
                <SimpleFeaturedCard
                  key={integration.id}
                  integration={integration}
                  onAppClick={onAppClick}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Discover;

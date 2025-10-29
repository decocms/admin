import {
  type Integration,
  MCPClient,
  MCPConnection,
  useMarketplaceIntegrations,
  useSDK,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { useUserPreferences } from "../../hooks/use-user-preferences.ts";
import { IntegrationAvatar } from "../common/avatar/integration.tsx";
import { AppKeys, getConnectionAppKey } from "../integrations/apps.ts";
import { VerifiedBadge } from "../integrations/marketplace.tsx";

// For the future, it should be controlled in a view
const HIGHLIGHTS = [
  {
    appName: "@deco/google-sheets",
    name: "Google Sheets",
    description: "Manage spreadsheets with structured data",
    banner:
      "https://assets.decocache.com/decocms/3cbf2b30-57aa-47a3-89c5-9277a6b8c993/googlesheets.png",
  },
];

// For the future, it should be controlled in a view
const FEATURED = ["@deco/airtable", "@deco/slack", "@deco/google-docs"];

type FeaturedIntegration = Integration & {
  provider: string;
  friendlyName?: string;
  verified?: boolean;
  unlisted?: boolean;
  connection: MCPConnection;
};

const FeaturedCard = ({
  integration,
}: {
  integration: FeaturedIntegration;
}) => {
  const navigateWorkspace = useNavigateWorkspace();
  const key = getConnectionAppKey(integration);
  const appKey = AppKeys.build(key);
  return (
    <div
      onClick={() => {
        navigateWorkspace(`/apps/${appKey}`);
      }}
      className="flex flex-col gap-2 p-4 bg-card relative rounded-xl cursor-pointer overflow-hidden"
    >
      <IntegrationAvatar
        url={integration.icon}
        fallback={integration.friendlyName ?? integration.name}
        size="lg"
      />
      <h3 className="text-sm flex gap-1 items-center">
        {integration.friendlyName || integration.name}
        {integration.verified && <VerifiedBadge />}
      </h3>
      <p className="text-sm text-muted-foreground">{integration.description}</p>
    </div>
  );
};

const SimpleFeaturedCard = ({
  integration,
}: {
  integration: FeaturedIntegration;
}) => {
  const navigateWorkspace = useNavigateWorkspace();
  const key = getConnectionAppKey(integration);
  const appKey = AppKeys.build(key);
  return (
    <div
      onClick={() => {
        navigateWorkspace(`/apps/${appKey}`);
      }}
      className="flex p-2 gap-2 cursor-pointer overflow-hidden items-center hover:bg-muted rounded-lg"
    >
      <IntegrationAvatar
        url={integration.icon}
        fallback={integration.friendlyName ?? integration.name}
        size="lg"
      />
      <div className="flex flex-col gap-1">
        <h3 className="text-sm flex gap-1 items-center">
          {integration.friendlyName || integration.name}
        </h3>
        <p className="text-sm text-muted-foreground">
          {integration.description}
        </p>
      </div>
    </div>
  );
};

const AdminFeaturedCard = ({
  integration,
}: {
  integration: FeaturedIntegration;
}) => {
  const navigateWorkspace = useNavigateWorkspace();
  const key = getConnectionAppKey(integration);
  const appKey = AppKeys.build(key);
  const { locator } = useSDK();
  const queryClient = useQueryClient();

  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Edit form state
  const [friendlyName, setFriendlyName] = useState(
    integration.friendlyName || integration.name,
  );
  const [iconUrl, setIconUrl] = useState(integration.icon || "");
  const [details, setDetails] = useState(integration.description || "");

  const handleToggleUnlisted = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsUpdating(true);
    try {
      const newUnlistedValue = !integration.unlisted;
      
      // If marking as unlisted AND it's verified, remove verification too
      const updates: { unlisted: boolean; verified?: boolean } = {
        unlisted: newUnlistedValue,
      };
      
      if (newUnlistedValue && integration.verified) {
        updates.verified = false;
      }
      
      await MCPClient.forLocator(locator).REGISTRY_UPDATE_APP_VISIBILITY({
        appId: integration.id,
        ...updates,
      });
      queryClient.invalidateQueries({
        queryKey: ["integrations", "marketplace"],
      });
    } catch (error) {
      console.error("Failed to update unlisted:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleVerified = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsUpdating(true);
    try {
      await MCPClient.forLocator(locator).REGISTRY_UPDATE_APP_VISIBILITY({
        appId: integration.id,
        verified: !integration.verified,
      });
      queryClient.invalidateQueries({
        queryKey: ["integrations", "marketplace"],
      });
    } catch (error) {
      console.error("Failed to update verified:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsUpdating(true);
    try {
      await MCPClient.forLocator(locator).REGISTRY_UPDATE_APP_VISIBILITY({
        appId: integration.id,
        friendlyName,
        icon: iconUrl,
        description: details,
      });
      queryClient.invalidateQueries({
        queryKey: ["integrations", "marketplace"],
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update app details:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFriendlyName(integration.friendlyName || integration.name);
    setIconUrl(integration.icon || "");
    setDetails(integration.description || "");
    setIsEditing(false);
  };

  return (
    <div
      onClick={() => navigateWorkspace(`/apps/${appKey}`)}
      className={`flex flex-col gap-2 p-4 bg-card relative rounded-xl cursor-pointer overflow-hidden ${
        integration.unlisted
          ? "border-2 border-amber-500"
          : "border border-border"
      }`}
    >
      {/* Edit button (admin only, since AdminFeaturedCard only renders in admin mode) */}
      {!isEditing && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-8 w-8"
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
        >
          <Icon name="edit" size={16} />
        </Button>
      )}

      {isEditing ? (
        <form className="space-y-3 mt-6" onSubmit={handleSaveEdit} onClick={(e) => e.stopPropagation()}>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Name</label>
            <Input
              value={friendlyName}
              onChange={(e) => setFriendlyName(e.target.value)}
              placeholder="App name"
              disabled={isUpdating}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Icon URL</label>
            <Input
              value={iconUrl}
              onChange={(e) => setIconUrl(e.target.value)}
              placeholder="https://..."
              disabled={isUpdating}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Description</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="App description"
              disabled={isUpdating}
              className="w-full min-h-[60px] px-3 py-2 text-sm border rounded-md resize-none"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isUpdating} className="flex-1">
              Save
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancelEdit}
              disabled={isUpdating}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          <IntegrationAvatar
            url={integration.icon}
            fallback={integration.friendlyName ?? integration.name}
            size="lg"
          />
          <h3 className="text-sm flex gap-1 items-center">
            {integration.friendlyName || integration.name}
            {integration.verified && <VerifiedBadge />}
          </h3>
          <p className="text-sm text-muted-foreground">{integration.description}</p>
        </>
      )}

      {/* Controles Admin */}
      {!isEditing && (
        <div
          className="flex flex-col xl:flex-row gap-2 mt-2"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant={integration.unlisted ? "destructive" : "default"}
            size="sm"
            onClick={handleToggleUnlisted}
            disabled={isUpdating}
            className="w-full xl:w-auto"
          >
            <Icon
              name={integration.unlisted ? "visibility_off" : "visibility"}
              size={16}
            />
            {integration.unlisted ? "Hidden" : "Visible"}
          </Button>
          <Button
            variant={integration.verified ? "default" : "outline"}
            size="sm"
            onClick={handleToggleVerified}
            disabled={isUpdating}
            className="w-full xl:w-auto"
          >
            <Icon name={integration.verified ? "verified" : "shield"} size={16} />
            {integration.verified ? "Verified" : "Unverified"}
          </Button>
        </div>
      )}
    </div>
  );
};

const Discover = () => {
  const [search, setSearch] = useState("");
  const [showUnlisted, setShowUnlisted] = useState(true);
  const { preferences } = useUserPreferences();
  const isAdminMode = preferences.storeAdminMode;

  // Fetch all apps when admin mode is active
  const { data: allIntegrations } = useMarketplaceIntegrations({
    includeAllUnlisted: isAdminMode,
  });
  // Fetch only public apps
  const { data: publicIntegrations } = useMarketplaceIntegrations({
    includeAllUnlisted: false,
  });

  // Use different data based on admin mode
  const integrations = isAdminMode ? allIntegrations : publicIntegrations;

  const navigateWorkspace = useNavigateWorkspace();

  const featuredIntegrations = integrations?.integrations.filter(
    (integration) => FEATURED.includes(integration.name),
  );
  const verifiedIntegrations = integrations?.integrations.filter(
    (integration) => integration.verified,
  );

  // Apps não listados - mostra apenas quando admin mode ativo
  const unlistedApps = useMemo(() => {
    if (!isAdminMode || !allIntegrations) return [];
    return allIntegrations.integrations.filter(
      (integration) => integration.unlisted,
    );
  }, [allIntegrations, isAdminMode]);

  // Apps listados - sempre usa a lista pública, ordenados: verificados primeiro
  const listedApps = useMemo(() => {
    const filtered = publicIntegrations?.integrations.filter(
      (integration) => !integration.unlisted,
    ) || [];
    
    // Ordenar: verificados primeiro
    return filtered.sort((a, b) => {
      if (a.verified && !b.verified) return -1;
      if (!a.verified && b.verified) return 1;
      return 0;
    });
  }, [publicIntegrations]);

  const highlights = useMemo(() => {
    return HIGHLIGHTS.map((highlight) => {
      const integration = integrations?.integrations.find(
        (integration) => integration.name === highlight.appName,
      );
      return {
        ...integration,
        ...highlight,
      };
    });
  }, [integrations]);

  const filteredIntegrations = useMemo(() => {
    return integrations?.integrations
      ?.filter(
        (integration) =>
          integration.name.toLowerCase().includes(search.toLowerCase()) ||
          integration.friendlyName
            ?.toLowerCase()
            .includes(search.toLowerCase()),
      )
      ?.slice(0, 7);
  }, [integrations, search]);

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-background p-4">
        <div className="flex justify-between items-center">
          <div className="flex gap-4 items-center">
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
            </div>
            {isAdminMode && (
              <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/20 border border-amber-500 rounded-md">
                <Icon
                  name="admin_panel_settings"
                  size={18}
                  className="text-amber-600"
                />
                <span className="text-sm font-medium text-amber-700">
                  Admin Mode Active
                </span>
              </div>
            )}
            {search && (
              <div className="z-20 p-2 bg-popover w-[370px] absolute left-0 top-[calc(100%+8px)] rounded-xl border border-border shadow-lg">
                {filteredIntegrations?.map((integration) => (
                  <SimpleFeaturedCard
                    key={"search-" + integration.id}
                    integration={integration}
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
              if (!item.id) {
                return null;
              }
              const key = getConnectionAppKey(item as Integration);
              const appKey = AppKeys.build(key);
              return (
                <button
                  key={item.appName}
                  type="button"
                  onClick={() => {
                    navigateWorkspace(`/apps/${appKey}`);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigateWorkspace(`/apps/${appKey}`);
                    }
                  }}
                  className="relative rounded-xl cursor-pointer overflow-hidden"
                >
                  <img
                    src={item.banner}
                    alt={item.appName || ""}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute flex flex-col bottom-6 left-6">
                    <IntegrationAvatar
                      url={item.icon}
                      fallback={item.friendlyName ?? item.name}
                      size="lg"
                      className="border-none mb-2"
                    />
                    <h3 className="flex gap-2 items-center text-3xl text-white mb-0.5">
                      {item.name || item.friendlyName || item.appName}
                      <VerifiedBadge />
                    </h3>
                    <p className="text-sm text-white">{item.description}</p>
                  </div>
                  <Button
                    className="absolute bottom-6 right-6"
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
                <FeaturedCard key={integration.id} integration={integration} />
              ))}
            </div>

            {isAdminMode && (
              <>
                <div
                  className="flex items-center justify-between pt-5 cursor-pointer"
                  onClick={() => setShowUnlisted(!showUnlisted)}
                >
                  <h2 className="text-lg font-medium text-amber-600">
                    Unlisted Apps (Admin Only)
                    <span className="text-muted-foreground font-mono font-normal text-sm ml-2">
                      {unlistedApps.length}
                    </span>
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowUnlisted(!showUnlisted);
                    }}
                  >
                    <Icon
                      name={showUnlisted ? "expand_less" : "expand_more"}
                      size={20}
                    />
                  </Button>
                </div>
                {showUnlisted && (
                  <>
                    {unlistedApps.length > 0 ? (
                      <div className="grid grid-cols-3 gap-4">
                        {unlistedApps
                          .filter(
                            (integration) =>
                              !search ||
                              integration.name
                                .toLowerCase()
                                .includes(search.toLowerCase()),
                          )
                          .map((integration) => (
                            <AdminFeaturedCard
                              key={integration.id}
                              integration={integration}
                            />
                          ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center p-8 border border-dashed border-amber-300 rounded-xl bg-amber-50/50">
                        <p className="text-sm text-amber-700">
                          No unlisted apps found. Apps with "unlisted: true" will
                          appear here.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            <h2 className="text-lg pt-5 font-medium">
              All Apps
              <span className="text-muted-foreground font-mono font-normal text-sm ml-2">
                {listedApps?.length}
              </span>
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {listedApps.map((integration) =>
                isAdminMode ? (
                  <AdminFeaturedCard
                    key={integration.id}
                    integration={integration}
                  />
                ) : (
                  <FeaturedCard
                    key={integration.id}
                    integration={integration}
                  />
                ),
              )}
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
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Discover;

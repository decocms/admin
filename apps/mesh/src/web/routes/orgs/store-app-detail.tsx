import { createToolCaller } from "@/tools/client";
import { OAuthConfig } from "@/tools/connection/schema";
import { CollectionSearch } from "@/web/components/collections/collection-search";
import { CollectionTableWrapper } from "@/web/components/collections/collection-table-wrapper";
import { EmptyState } from "@/web/components/empty-state";
import type { MCPRegistryServer } from "@/web/components/store/registry-item-card";
import type { RegistryItem } from "@/web/components/store/registry-items-section";
import {
  CONNECTIONS_COLLECTION,
  useConnection,
  useConnections,
} from "@/web/hooks/collections/use-connection";
import { useRegistryConnections } from "@/web/hooks/use-binding";
import { usePublisherConnection } from "@/web/hooks/use-publisher-connection";
import { useToolCall } from "@/web/hooks/use-tool-call";
import { authClient } from "@/web/lib/auth-client";
import { useProjectContext } from "@/web/providers/project-context-provider";
import {
  MCP_REGISTRY_DECOCMS_KEY,
  MCP_REGISTRY_PUBLISHER_KEY,
} from "@/web/utils/constants";
import { slugify } from "@/web/utils/slugify";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

/** Extract connection data from a registry item for installation */
function extractConnectionData(
  item: RegistryItem,
  organizationId: string,
  userId: string,
) {
  const server = item.server as MCPRegistryServer["server"] | undefined;

  const meshMeta =
    item._meta?.[MCP_REGISTRY_DECOCMS_KEY] ??
    server?._meta?.[MCP_REGISTRY_DECOCMS_KEY];
  const publisherMeta =
    item._meta?.[MCP_REGISTRY_PUBLISHER_KEY] ??
    server?._meta?.[MCP_REGISTRY_PUBLISHER_KEY];

  const appMetadata = publisherMeta?.metadata as
    | Record<string, unknown>
    | null
    | undefined;

  const remote = server?.remotes?.[0];

  const connectionTypeMap: Record<string, "HTTP" | "SSE" | "Websocket"> = {
    http: "HTTP",
    sse: "SSE",
    websocket: "Websocket",
  };

  const connectionType = remote?.type
    ? connectionTypeMap[remote.type] || "HTTP"
    : "HTTP";

  const now = new Date().toISOString();

  const title =
    publisherMeta?.friendlyName ||
    item.title ||
    server?.title ||
    server?.name ||
    "Unnamed App";

  const description = server?.description || null;

  const icon = server?.icons?.[0]?.src || null;

  const rawOauthConfig = appMetadata?.oauth_config as
    | Record<string, unknown>
    | null
    | undefined;
  const oauthConfig: OAuthConfig | null =
    rawOauthConfig &&
    typeof rawOauthConfig.authorizationEndpoint === "string" &&
    typeof rawOauthConfig.tokenEndpoint === "string" &&
    typeof rawOauthConfig.clientId === "string" &&
    Array.isArray(rawOauthConfig.scopes) &&
    (rawOauthConfig.grantType === "authorization_code" ||
      rawOauthConfig.grantType === "client_credentials")
      ? (rawOauthConfig as unknown as OAuthConfig)
      : null;

  const configState = appMetadata?.configuration_state as
    | Record<string, unknown>
    | null
    | undefined;
  const configScopes = appMetadata?.configuration_scopes as
    | string[]
    | null
    | undefined;

  return {
    id: crypto.randomUUID(),
    title,
    description,
    icon,
    app_name: meshMeta?.appName || server?.name || null,
    app_id: meshMeta?.id || item.id || null,
    connection_type: connectionType,
    connection_url: remote?.url || "",
    connection_token: null,
    connection_headers: null,
    oauth_config: oauthConfig,
    configuration_state: configState ?? null,
    configuration_scopes: configScopes ?? null,
    metadata: {
      ...appMetadata,
      source: "store",
      registry_item_id: item.id,
      verified: meshMeta?.verified ?? false,
      scopeName: meshMeta?.scopeName ?? null,
      toolsCount: publisherMeta?.tools?.length ?? 0,
      publishedAt: meshMeta?.publishedAt ?? null,
    },
    created_at: now,
    updated_at: now,
    created_by: userId,
    organization_id: organizationId,
    tools: null,
    bindings: null,
    status: "inactive" as const,
  };
}

/** Get publisher info (logo and app count) from items in the store or connection in database */
function getPublisherInfo(
  items: RegistryItem[],
  publisherName: string,
  publisherConnection?: { icon: string | null } | null,
): { logo?: string; count: number } {
  if (!publisherName || publisherName === "Unknown") {
    return { count: 0 };
  }

  const publisherLower = publisherName.toLowerCase();
  const matchingItems = items.filter((item) => {
    const itemPublisher =
      item.publisher || item._meta?.["mcp.mesh"]?.scopeName || "Unknown";
    return itemPublisher.toLowerCase() === publisherLower;
  });

  // Priority: connection icon > store publisher_logo > store icon
  const logo =
    publisherConnection?.icon ||
    matchingItems[0]?.publisher_logo ||
    matchingItems[0]?.icon ||
    undefined;

  return {
    logo,
    count: matchingItems.length,
  };
}

/** Format date to MMM DD, YYYY format */
function formatLastUpdated(date: unknown): string {
  if (!date) return "—";
  try {
    const parsedDate = new Date(date as string);
    if (isNaN(parsedDate.getTime())) return "—";
    return parsedDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

/** Component for rendering tools table */
function ToolsTable({
  tools,
  search,
  sortKey,
  sortDirection,
  onSort,
}: {
  tools: Array<Record<string, unknown>>;
  search: string;
  sortKey: string | undefined;
  sortDirection: "asc" | "desc" | null;
  onSort: (key: string) => void;
}) {
  // Filter tools
  const filteredTools = useMemo(() => {
    if (!search.trim()) return tools;
    const searchLower = search.toLowerCase();
    return tools.filter((tool) => {
      const name = (tool.name as string) || "";
      const desc = (tool.description as string) || "";
      return (
        name.toLowerCase().includes(searchLower) ||
        desc.toLowerCase().includes(searchLower)
      );
    });
  }, [tools, search]);

  // Sort tools
  const sortedTools = useMemo(() => {
    if (!sortKey || !sortDirection) return filteredTools;
    return [...filteredTools].sort((a, b) => {
      const aVal = (a[sortKey] as string) || "";
      const bVal = (b[sortKey] as string) || "";
      const comparison = String(aVal).localeCompare(String(bVal));
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredTools, sortKey, sortDirection]);

  const columns = [
    {
      id: "name",
      header: "Name",
      render: (tool: Record<string, unknown>) => (
        <span className="text-sm font-medium font-mono text-foreground">
          {(tool.name as string) || "—"}
        </span>
      ),
      sortable: true,
    },
    {
      id: "description",
      header: "Description",
      render: (tool: Record<string, unknown>) => (
        <span className="text-sm text-foreground">
          {(tool.description as string) || "—"}
        </span>
      ),
      cellClassName: "flex-1",
      sortable: true,
    },
  ];

  return (
    <CollectionTableWrapper
      columns={columns}
      data={sortedTools}
      isLoading={false}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={onSort}
      emptyState={
        <EmptyState
          image={null}
          title={search ? "No tools found" : "No tools available"}
          description={
            search
              ? "Try adjusting your search terms"
              : "This app doesn't have any tools."
          }
        />
      }
    />
  );
}

/** Helper to extract data from different JSON structures */
function extractItemData(item: RegistryItem) {
  const publisherMeta = item.server?._meta?.["mcp.mesh/publisher-provided"];
  const decoMeta = item._meta?.["mcp.mesh"];

  return {
    name: item.name || item.title || item.server?.title || "Unnamed Item",
    description:
      item.description || item.summary || item.server?.description || "",
    icon: item.icon || item.image || item.logo || item.server?.icons?.[0]?.src,
    verified: item.verified || decoMeta?.verified,
    publisher: item.publisher || decoMeta?.scopeName || "Unknown",
    tools: item.tools || item.server?.tools || publisherMeta?.tools || [],
    models: item.models || item.server?.models || publisherMeta?.models || [],
    emails: item.emails || item.server?.emails || publisherMeta?.emails || [],
    analytics:
      item.analytics || item.server?.analytics || publisherMeta?.analytics,
    cdn: item.cdn || item.server?.cdn || publisherMeta?.cdn,
  };
}

export default function StoreAppDetail() {
  const { org } = useProjectContext();
  const navigate = useNavigate();
  // Get appName from the child route (just /$appName)
  const { appName } = useParams({ strict: false }) as { appName?: string };
  const { registryId: registryIdParam } = useSearch({ strict: false }) as {
    registryId?: string;
  };

  // Track active tab - initially "tools"
  const [activeTabId, setActiveTabId] = useState<string>("tools");

  // Track search and sorting for tools
  const [search, setSearch] = useState<string>("");
  const [sortKey, setSortKey] = useState<string | undefined>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>(
    "asc",
  );
  const [isInstalling, setIsInstalling] = useState(false);

  const allConnections = useConnections();
  const { data: session } = authClient.useSession();
  const registryConnections = useRegistryConnections(allConnections);

  // Use passed registryId or default to first one
  const effectiveRegistryId =
    registryIdParam || registryConnections[0]?.id || "";

  const registryConnection = useConnection(effectiveRegistryId);

  // Find the LIST tool from the registry connection
  const listToolName = useMemo(() => {
    if (!registryConnection?.tools) return "";
    const listTool = registryConnection.tools.find((tool) =>
      tool.name.endsWith("_LIST"),
    );
    return listTool?.name || "";
  }, [registryConnection?.tools]);

  const toolCaller = useMemo(
    () => createToolCaller(effectiveRegistryId),
    [effectiveRegistryId],
  );

  const {
    data: listResults,
    isLoading,
    error,
  } = useToolCall({
    toolCaller,
    toolName: listToolName,
    toolInputParams: {},
    enabled: !!listToolName && !!effectiveRegistryId,
  });

  // Extract items from results without transformation
  const items: RegistryItem[] = useMemo(() => {
    if (!listResults) return [];

    // Direct array response
    if (Array.isArray(listResults)) {
      return listResults;
    }

    // Object with nested array
    if (typeof listResults === "object" && listResults !== null) {
      const itemsKey = Object.keys(listResults).find((key) =>
        Array.isArray(listResults[key as keyof typeof listResults]),
      );

      if (itemsKey) {
        return listResults[
          itemsKey as keyof typeof listResults
        ] as RegistryItem[];
      }
    }

    return [];
  }, [listResults]);

  // Find the item matching the appName slug
  const selectedItem = useMemo(() => {
    return items.find((item) => {
      const itemName = item.name || item.title || item.server?.title || "";
      return slugify(itemName) === appName;
    });
  }, [items, appName]);

  // Extract data from item (moved before conditionals to ensure hook order)
  const data = selectedItem ? extractItemData(selectedItem) : null;

  // Get publisher connection from database (moved before conditionals to ensure hook order)
  const publisherConnection = usePublisherConnection(
    allConnections,
    data?.publisher,
  );

  // Calculate publisher info (logo and apps count) (moved before conditionals to ensure hook order)
  const publisherInfo = useMemo(() => {
    if (!data) return { count: 0 };
    return getPublisherInfo(items, data.publisher, publisherConnection);
  }, [items, data, publisherConnection]);

  const availableTabs = useMemo(() => {
    return [
      { id: "tools", label: "Tools", visible: (data?.tools?.length || 0) > 0 },
    ].filter((tab) => tab.visible);
  }, [data?.tools?.length]);

  // Calculate effective active tab - use current activeTabId if available, otherwise use first available tab
  const effectiveActiveTabId = useMemo(() => {
    if (availableTabs.find((t) => t.id === activeTabId)) {
      return activeTabId;
    }
    return availableTabs[0]?.id || "overview";
  }, [activeTabId, availableTabs]);

  const handleInstall = async () => {
    if (!selectedItem || !org || !session?.user?.id) return;

    const connectionData = extractConnectionData(
      selectedItem,
      org,
      session.user.id,
    );

    if (!connectionData.connection_url) {
      toast.error("This app cannot be installed: no connection URL available");
      return;
    }

    setIsInstalling(true);
    try {
      const tx = await CONNECTIONS_COLLECTION.insert(connectionData);
      await tx.isPersisted.promise;

      toast.success(`${connectionData.title} installed successfully`);

      // Use the deterministic ID to directly look up the connection
      const newConnection = CONNECTIONS_COLLECTION.get(connectionData.id);

      if (newConnection?.id && org) {
        navigate({
          to: "/$org/mcps/$connectionId",
          params: { org, connectionId: newConnection.id },
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to install app: ${message}`);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleBackClick = () => {
    navigate({
      to: "/$org/store",
      params: { org },
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Icon
          name="progress_activity"
          size={48}
          className="animate-spin mb-4"
        />
        <p className="text-sm text-muted-foreground">Loading app details...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Icon name="error" size={48} className="text-destructive mb-4" />
        <h3 className="text-lg font-medium mb-2">Error loading app</h3>
        <p className="text-muted-foreground max-w-md text-center">
          {error instanceof Error ? error.message : "Unknown error occurred"}
        </p>
        <button
          onClick={handleBackClick}
          className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  // Not found state
  if (!selectedItem) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Icon
          name="search_off"
          size={48}
          className="text-muted-foreground mb-4"
        />
        <h3 className="text-lg font-medium mb-2">App not found</h3>
        <p className="text-muted-foreground max-w-md text-center">
          The app you're looking for doesn't exist in this store.
        </p>
        <button
          onClick={handleBackClick}
          className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          Go Back to Store
        </button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="flex flex-col h-full border-l border-border">
      {/* Header */}
      <div className="shrink-0 bg-background border-b border-border px-4 py-3">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={handleBackClick}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon name="arrow_back" size={20} />
            Back
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pt-10 h-full">
        <div className="h-full">
          <div className="max-w-7xl mx-auto h-full">
            {/* SECTION 1: Hero (Full Width) */}
            <div className="pl-10 flex items-start gap-6 pb-12 pr-10 border-b border-border">
              <div className="shrink-0 w-16 h-16 rounded-2xl bg-linear-to-br from-primary/20 to-primary/10 flex items-center justify-center text-3xl font-bold text-primary">
                {data.icon ? (
                  <img
                    src={data.icon}
                    alt={data.name}
                    className="w-full h-full object-cover rounded-2xl"
                  />
                ) : (
                  data.name.substring(0, 2).toUpperCase()
                )}
              </div>

              <div className="flex-1 min-w-0 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h1 className="text-3xl font-bold">{data.name}</h1>
                    {data.verified && (
                      <img
                        src="/verified-badge.svg"
                        alt="Verified"
                        className="w-5 h-5 shrink-0"
                      />
                    )}
                  </div>
                  {data.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {data.description}
                    </p>
                  )}
                </div>
                <Button
                  variant="brand"
                  onClick={handleInstall}
                  disabled={isInstalling}
                  className="shrink-0"
                >
                  {isInstalling ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Installing...
                    </>
                  ) : (
                    <>
                      <Icon name="add" size={20} />
                      Install App
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* SECTION 2 & 3: Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 min-h-[677px]">
              {/* SECTION 2: Left Column (Overview + Publisher) */}
              <div className="lg:col-span-1 flex flex-col pt-5">
                {/* Overview */}
                {data.description && (
                  <div className="px-5 pb-5 border-b border-border">
                    <h2 className="text-lg font-medium mb-3">Overview</h2>
                    <p className="text-muted-foreground leading-relaxed">
                      {data.description}
                    </p>
                  </div>
                )}

                {/* Publisher */}
                <div className="px-5 border-b border-border">
                  <div className="flex items-center gap-3 py-5">
                    <div className="w-12 h-12 rounded-lg bg-linear-to-br from-primary/20 to-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0 overflow-hidden">
                      {publisherInfo.logo ? (
                        <img
                          src={publisherInfo.logo}
                          alt={data.publisher}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        data.publisher.substring(0, 2).toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="font-medium capitalize">
                        {data.publisher}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        {publisherInfo.count > 0 ? (
                          <>
                            <img
                              src="/globe.svg"
                              alt="globe"
                              className="w-3 h-3"
                            />
                            <span>
                              {publisherInfo.count}{" "}
                              {publisherInfo.count === 1
                                ? "published app"
                                : "published apps"}
                            </span>
                          </>
                        ) : (
                          "Publisher"
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Last Updated */}
                <div className="px-5 py-5 text-sm flex justify-between items-center border-b border-border">
                  <span className="text-foreground text-sm">Last Updated</span>
                  <span className="text-muted-foreground uppercase text-xs">
                    {formatLastUpdated(selectedItem.updated_at)}
                  </span>
                </div>
              </div>

              {/* SECTION 3: Right Column (Tabs + Content) */}
              <div className="lg:col-span-2 flex flex-col border-l border-border">
                {/* Tabs Section */}
                {availableTabs.length > 0 && (
                  <div className="flex items-center gap-2 p-4 border-b border-border bg-background">
                    {availableTabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTabId(tab.id)}
                        className={`inline-flex items-center justify-center whitespace-nowrap text-sm font-medium px-3 py-1.5 h-8 rounded-lg border transition-colors ${
                          effectiveActiveTabId === tab.id
                            ? "bg-muted border-input text-foreground"
                            : "bg-transparent border-transparent text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Tools Tab Content */}
                {effectiveActiveTabId === "tools" && data.tools.length > 0 && (
                  <div className="flex flex-col">
                    {/* Search Section */}
                    <div className="border-b border-border bg-background">
                      <CollectionSearch
                        value={search}
                        onChange={setSearch}
                        placeholder="Search for tools..."
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setSearch("");
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                      />
                    </div>

                    {/* Table Section */}
                    <div className="bg-background overflow-hidden">
                      <ToolsTable
                        tools={data.tools as Array<Record<string, unknown>>}
                        search={search}
                        sortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={(key) => {
                          if (sortKey === key) {
                            setSortDirection((prev) =>
                              prev === "asc"
                                ? "desc"
                                : prev === "desc"
                                  ? null
                                  : "asc",
                            );
                            if (sortDirection === "desc") setSortKey(undefined);
                          } else {
                            setSortKey(key);
                            setSortDirection("asc");
                          }
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Overview Tab Content */}
                {effectiveActiveTabId === "overview" && (
                  <div className="p-4 bg-background">
                    <p className="text-muted-foreground leading-relaxed">
                      {data.description || "No overview available"}
                    </p>
                  </div>
                )}

                {/* Models Tab Content */}
                {effectiveActiveTabId === "models" && data.models && (
                  <div className="p-4 bg-background text-muted-foreground">
                    <p>Models information</p>
                  </div>
                )}

                {/* Emails Tab Content */}
                {effectiveActiveTabId === "emails" && data.emails && (
                  <div className="p-4 bg-background text-muted-foreground">
                    <p>Email configuration available</p>
                  </div>
                )}

                {/* Analytics Tab Content */}
                {effectiveActiveTabId === "analytics" &&
                  (data.analytics as unknown) != null && (
                    <div className="p-4 bg-background text-muted-foreground">
                      <p>Analytics configuration available</p>
                    </div>
                  )}

                {/* CDN Tab Content */}
                {effectiveActiveTabId === "cdn" &&
                  (data.cdn as unknown) != null && (
                    <div className="p-4 bg-background text-muted-foreground">
                      <p>CDN configuration available</p>
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

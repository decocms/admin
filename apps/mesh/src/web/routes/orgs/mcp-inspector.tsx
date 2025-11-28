import { createToolCaller } from "@/tools/client";
import type { ConnectionEntity } from "@/tools/connection/schema";
import { CollectionsList } from "@/web/components/collections-list.tsx";
import { ConnectionDetailsSidebar } from "@/web/components/connection-details-sidebar.tsx";
import { EmptyState } from "@/web/components/empty-state.tsx";
import {
  useConnection,
  useConnectionsCollection,
} from "@/web/hooks/collections/use-connection";
import { useCollectionBindings } from "@/web/hooks/use-binding";
import { KEYS } from "@/web/lib/query-keys";
import { Button } from "@deco/ui/components/button.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { ResourceTabs } from "@deco/ui/components/resource-tabs.tsx";
import type { BaseCollectionEntity } from "@decocms/bindings/collections";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Lock, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useMcp } from "use-mcp/react";

export default function McpInspector() {
  const { connectionId, org } = useParams({ strict: false });
  const navigate = useNavigate();
  // We can use search params for active tab if we want persistent tabs
  const search = useSearch({ strict: false }) as { tab?: string };
  const [activeTabId, setActiveTabId] = useState<string>(search.tab || "tools");
  const [searchValue, setSearchValue] = useState("");

  const { data: connection } = useConnection(connectionId);
  const connectionsCollection = useConnectionsCollection();

  // Detect collection bindings
  const collections = useCollectionBindings(connection);

  // Update connection handler
  const handleUpdateConnection = async (
    updatedConnection: Partial<ConnectionEntity>,
  ) => {
    if (!connection || !connectionsCollection) return;

    try {
      const tx = connectionsCollection.update(connection.id, (draft: any) => {
        if (updatedConnection.title !== undefined)
          draft.title = updatedConnection.title;
        if (updatedConnection.description !== undefined)
          draft.description = updatedConnection.description;
        if (updatedConnection.connection_type !== undefined)
          draft.connection_type = updatedConnection.connection_type;
        if (updatedConnection.connection_url !== undefined)
          draft.connection_url = updatedConnection.connection_url;
        if (updatedConnection.connection_token !== undefined)
          draft.connection_token = updatedConnection.connection_token;
      });
      await tx.isPersisted.promise;
      toast.success("Connection updated successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to update connection: ${message}`);
      throw error;
    }
  };

  // Initialize MCP connection
  const normalizeUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      parsed.pathname = parsed.pathname.replace(/\/i:([a-f0-9-]+)/gi, "/$1");
      return parsed.toString();
    } catch {
      return url;
    }
  };

  const normalizedUrl = connection?.connection_url
    ? normalizeUrl(connection.connection_url)
    : "";

  const mcp = useMcp({
    url: normalizedUrl,
    clientName: "MCP Mesh Inspector",
    clientUri: window.location.origin,
    callbackUrl: `${window.location.origin}/oauth/callback`,
    debug: true,
    autoReconnect: true,
    autoRetry: 5000,
    onPopupWindow: (_url, _features, popupWindow) => {
      const captureTokenSnapshot = (prefix: string): Map<string, string> => {
        const snapshot = new Map<string, string>();
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (
            key &&
            key.startsWith(prefix) &&
            (key.endsWith("_tokens") ||
              key.endsWith(":token") ||
              key.endsWith(":tokens"))
          ) {
            const value = localStorage.getItem(key);
            if (value) {
              snapshot.set(key, value);
            }
          }
        }
        return snapshot;
      };

      const tokenSnapshotBefore = captureTokenSnapshot("mcp:auth");

      if (connection && connectionId) {
        localStorage.setItem(
          "mcp_oauth_pending",
          JSON.stringify({
            connectionId: connectionId as string,
            orgId: connection.organization_id,
            connectionType: connection.connection_type,
            connectionUrl: connection.connection_url,
            timestamp: Date.now(),
          }),
        );
      }

      const messageHandler = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;

        if (event.data.type === "mcp:oauth:complete") {
          if (event.data.success && connection && connectionId) {
            try {
              const tokenSnapshotAfter = captureTokenSnapshot("mcp:auth");
              let newOrChangedToken: string | null = null;

              for (const [key, value] of tokenSnapshotAfter) {
                const beforeValue = tokenSnapshotBefore.get(key);
                if (!beforeValue || beforeValue !== value) {
                  try {
                    const parsed = JSON.parse(value);
                    newOrChangedToken =
                      parsed.access_token || parsed.accessToken || value;
                  } catch {
                    newOrChangedToken = value;
                  }
                  break;
                }
              }

              if (newOrChangedToken) {
                if (!connectionsCollection) {
                  throw new Error("Connections collection not initialized");
                }
                if (!connectionsCollection.has(connectionId as string)) {
                  throw new Error("Connection not found in collection");
                }

                const tx = connectionsCollection.update(
                  connectionId as string,
                  (draft: any) => {
                    draft.connection_type = connection.connection_type;
                    draft.connection_url = connection.connection_url;
                    draft.connection_token = newOrChangedToken;
                  },
                );
                await tx.isPersisted.promise;
              }

              localStorage.removeItem("mcp_oauth_pending");
            } catch (saveErr) {
              toast.error(
                `Failed to save token: ${saveErr instanceof Error ? saveErr.message : String(saveErr)}`,
              );
            }

            if (popupWindow && !popupWindow.closed) {
              popupWindow.close();
            }
            window.removeEventListener("message", messageHandler);
          } else if (!event.data.success) {
            toast.error(`OAuth failed: ${event.data.error || "Unknown error"}`);
            if (popupWindow && !popupWindow.closed) {
              popupWindow.close();
            }
            window.removeEventListener("message", messageHandler);
          }
        }
      };

      window.addEventListener("message", messageHandler);
      setTimeout(
        () => {
          window.removeEventListener("message", messageHandler);
        },
        5 * 60 * 1000,
      );
    },
  });

  if (!connection && connectionId) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-muted-foreground">Connection not found</div>
      </div>
    );
  }

  const tabs = [
    { id: "tools", label: "Tools", count: mcp.tools?.length ?? 0 },
    ...(collections || []).map((c) => ({
      id: c.name,
      label: c.displayName,
    })),
  ];

  const handleTabChange = (tabId: string) => {
    setActiveTabId(tabId);
    setSearchValue(""); // Reset search on tab change
    // Optionally update URL search params
    navigate({
      search: (prev: Record<string, unknown>) => ({ ...prev, tab: tabId }),
      replace: true,
    });
  };

  return (
    <div className="flex h-full w-full bg-background overflow-hidden">
      <ConnectionDetailsSidebar
        connection={connection}
        onUpdate={handleUpdateConnection}
      />

      <div className="flex-1 flex flex-col min-w-0 bg-background">
        <div className="border-b border-border px-6 py-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <ResourceTabs
              tabs={tabs}
              activeTab={activeTabId}
              onTabChange={handleTabChange}
            />
          </div>

          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${activeTabId === "tools" ? "tools" : "items"}...`}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-9 h-8"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {mcp.state === "pending_auth" || mcp.state === "authenticating" ? (
            <EmptyState
              image={
                <div className="bg-muted p-4 rounded-full">
                  <Lock className="w-8 h-8 text-muted-foreground" />
                </div>
              }
              title="Authorization Required"
              description="This connection requires authorization to access tools and resources."
              actions={
                <Button
                  onClick={() => mcp.authenticate()}
                  disabled={mcp.state === "authenticating"}
                >
                  {mcp.state === "authenticating"
                    ? "Authorizing..."
                    : "Authorize"}
                </Button>
              }
              className="h-full"
            />
          ) : activeTabId === "tools" ? (
            <ToolsList
              tools={mcp.tools}
              search={searchValue}
              connectionId={connectionId as string}
              org={org as string}
            />
          ) : (
            <CollectionContent
              key={activeTabId}
              connectionId={connectionId as string}
              collectionName={activeTabId}
              search={searchValue}
              org={org as string}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ToolsList({
  tools,
  search,
  connectionId,
  org,
}: {
  tools: any[];
  search: string;
  connectionId: string;
  org: string;
}) {
  const navigate = useNavigate();

  const filteredTools = useMemo(() => {
    if (!search.trim()) return tools;
    const searchLower = search.toLowerCase();
    return tools.filter(
      (t) =>
        t.name.toLowerCase().includes(searchLower) ||
        (t.description && t.description.toLowerCase().includes(searchLower)),
    );
  }, [tools, search]);

  const columns = [
    {
      id: "name",
      header: "NAME",
      accessor: (tool: any) => (
        <div className="font-medium font-mono text-sm">{tool.name}</div>
      ),
      sortable: true,
    },
    {
      id: "description",
      header: "DESCRIPTION",
      accessor: (tool: any) => (
        <div className="text-muted-foreground text-sm line-clamp-1">
          {tool.description}
        </div>
      ),
    },
  ];

  return (
    <CollectionsList
      data={filteredTools}
      viewMode="table"
      columns={columns}
      onItemClick={(tool) => {
        navigate({
          to: `/${org}/mcps/${connectionId}/tools/${tool.name}`,
        });
      }}
      emptyState={
        <div className="text-center py-12 text-muted-foreground">
          {search ? "No tools found matching search" : "No tools available"}
        </div>
      }
    />
  );
}

function CollectionContent({
  connectionId,
  collectionName,
  search,
  org,
}: {
  connectionId: string;
  collectionName: string;
  search: string;
  org: string;
}) {
  const navigate = useNavigate();
  const toolCaller = useMemo(
    () => createToolCaller(connectionId),
    [connectionId],
  );

  const { data, isLoading, isError, error } = useQuery({
    queryKey: KEYS.collectionItems(connectionId, collectionName),
    queryFn: async () => {
      const toolName = `COLLECTION_${collectionName}_LIST`;
      const result = await toolCaller(toolName, {});
      return result as { items: BaseCollectionEntity[] };
    },
    staleTime: 30_000,
  });

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    if (!search.trim()) return data.items;
    const searchLower = search.toLowerCase();
    return data.items.filter((item) =>
      item.title.toLowerCase().includes(searchLower),
    );
  }, [data?.items, search]);

  const columns = [
    {
      id: "title",
      header: "NAME",
      accessor: (item: BaseCollectionEntity) => (
        <div className="font-medium">{item.title}</div>
      ),
      sortable: true,
    },
    {
      id: "id",
      header: "ID",
      accessor: (item: BaseCollectionEntity) => (
        <div className="font-mono text-xs text-muted-foreground truncate max-w-[120px]">
          {item.id}
        </div>
      ),
    },
    {
      id: "updated_at",
      header: "LAST UPDATED",
      accessor: (item: BaseCollectionEntity) => (
        <div className="text-muted-foreground text-sm">
          {item.updated_at
            ? formatDistanceToNow(new Date(item.updated_at), {
                addSuffix: true,
              })
            : "-"}
        </div>
      ),
    },
  ];

  if (isError) {
    return (
      <div className="p-4 text-sm text-destructive border border-destructive/30 bg-destructive/10 rounded-md">
        Failed to load collection:{" "}
        {error instanceof Error ? error.message : String(error)}
      </div>
    );
  }

  return (
    <CollectionsList
      data={filteredItems}
      viewMode="table"
      isLoading={isLoading}
      columns={columns}
      onItemClick={(item) => {
        navigate({
          to: `/${org}/mcps/${connectionId}/${collectionName}/${item.id}`,
        });
      }}
      emptyState={
        <div className="text-center py-12 text-muted-foreground">
          {search ? "No items found matching search" : "No items found"}
        </div>
      }
    />
  );
}

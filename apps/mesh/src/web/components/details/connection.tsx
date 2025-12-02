import { ConnectionEntitySchema } from "@/tools/connection/schema";
import type { ConnectionEntity } from "@/tools/connection/schema";
import { CollectionsList } from "@/web/components/collections/collections-list.tsx";
import { EmptyState } from "@/web/components/empty-state.tsx";
import { ViewLayout, ViewTabs } from "./layout";
import {
  useConnection,
  useConnectionsCollection,
} from "@/web/hooks/collections/use-connection";
import { useCollectionBindings } from "@/web/hooks/use-binding";
import { useCollection, useCollectionList } from "@/web/hooks/use-collections";
import { useListState } from "@/web/hooks/use-list-state";
import { jsonSchemaToZod } from "@/web/utils/schema-converter";
import { Button } from "@deco/ui/components/button.tsx";
import { Card } from "@deco/ui/components/card.tsx";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { ResourceTabs } from "@deco/ui/components/resource-tabs.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { zodResolver } from "@hookform/resolvers/zod";
import type { BaseCollectionEntity } from "@decocms/bindings/collections";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, Globe, Loader2, Lock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useMcp } from "use-mcp/react";
import { z } from "zod";

export default function ConnectionInspectorView() {
  const { connectionId, org } = useParams({ strict: false });
  const navigate = useNavigate({ from: "/$org/mcps/$connectionId" });
  // We can use search params for active tab if we want persistent tabs
  const search = useSearch({ strict: false }) as { tab?: string };
  const [activeTabId, setActiveTabId] = useState<string>(search.tab || "tools");

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
      const tx = connectionsCollection.update(
        connection.id,
        (draft: ConnectionEntity) => {
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
        },
      );
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
    debug: false,
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
                  (draft: ConnectionEntity) => {
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
    navigate({
      search: (prev) => ({ ...prev, tab: tabId }),
      replace: true,
    });
  };

  const activeCollection = collections.find((c) => c.name === activeTabId);

  return (
    <ViewLayout onBack={() => window.history.back()}>
      <ViewTabs>
        <ResourceTabs
          tabs={tabs}
          activeTab={activeTabId}
          onTabChange={handleTabChange}
        />
      </ViewTabs>
      <div className="flex h-full w-full bg-background overflow-hidden">
        <Sidebar connection={connection} onUpdate={handleUpdateConnection} />

        <div className="flex-1 flex flex-col min-w-0 bg-background overflow-auto">
          <div className="flex-1 p-6">
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
                connectionId={connectionId as string}
                org={org as string}
              />
            ) : (
              <CollectionContent
                key={activeTabId}
                connectionId={connectionId as string}
                collectionName={activeTabId}
                org={org as string}
                schema={activeCollection?.schema}
              />
            )}
          </div>
        </div>
      </div>
    </ViewLayout>
  );
}

const connectionFormSchema = ConnectionEntitySchema.pick({
  title: true,
  description: true,
  connection_type: true,
  connection_url: true,
  connection_token: true,
}).partial({
  description: true,
  connection_token: true,
});

type ConnectionFormData = z.infer<typeof connectionFormSchema>;

interface ConnectionDetailsSidebarProps {
  connection: ConnectionEntity;
  onUpdate?: (connection: Partial<ConnectionEntity>) => Promise<void>;
}

function Sidebar({ connection, onUpdate }: ConnectionDetailsSidebarProps) {
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<ConnectionFormData>({
    resolver: zodResolver(connectionFormSchema),
    defaultValues: {
      title: connection.title,
      description: connection.description,
      connection_type: connection.connection_type,
      connection_url: connection.connection_url,
      connection_token: connection.connection_token,
    },
  });

  // Reset form when connection changes (external update)
  useEffect(() => {
    form.reset({
      title: connection.title,
      description: connection.description,
      connection_type: connection.connection_type,
      connection_url: connection.connection_url,
      connection_token: connection.connection_token,
    });
  }, [connection, form]);

  const onSubmit = async (data: ConnectionFormData) => {
    if (!onUpdate) return;
    setIsSaving(true);
    try {
      await onUpdate({
        ...data,
        description: data.description || null,
        connection_token: data.connection_token || null,
      });
      form.reset(data); // Reset dirty state with new values
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full border-r border-border w-[320px] bg-background shrink-0">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col flex-1 min-h-0"
        >
          <div className="p-6 border-b border-border flex flex-col gap-4">
            <div className="h-16 w-16 rounded-2xl border border-border/50 bg-white shadow-sm flex items-center justify-center overflow-hidden shrink-0">
              <Globe className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="w-full space-y-0">
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          {...field}
                          className="h-auto text-xl font-semibold px-0 border-transparent hover:border-input focus:border-input bg-transparent transition-all p-0"
                          placeholder="Connection Name"
                        />
                      </FormControl>
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="w-full space-y-0">
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ""}
                        className="h-auto text-sm text-muted-foreground px-0 border-transparent hover:border-input focus:border-input bg-transparent transition-all"
                        placeholder="Add a description..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="p-6 flex flex-col gap-4 border-b border-border flex-1 overflow-y-auto">
            <div className="flex flex-col gap-2">
              <FormLabel>Connection</FormLabel>
              <div className="flex rounded-md shadow-sm">
                <FormField
                  control={form.control}
                  name="connection_type"
                  render={({ field }) => (
                    <FormItem className="space-y-0">
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="w-[100px] rounded-r-none border-r-0 bg-muted/50 focus:ring-0 focus:ring-offset-0">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="HTTP">HTTP</SelectItem>
                          <SelectItem value="SSE">SSE</SelectItem>
                          <SelectItem value="Websocket">Websocket</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="connection_url"
                  render={({ field }) => (
                    <FormItem className="flex-1 space-y-0">
                      <FormControl>
                        <Input
                          placeholder="https://example.com/mcp"
                          {...field}
                          className="rounded-l-none focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="connection_type"
                render={() => <FormMessage />}
              />
              <FormField
                control={form.control}
                name="connection_url"
                render={() => <FormMessage />}
              />
            </div>

            <FormField
              control={form.control}
              name="connection_token"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Token</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder={
                        connection.connection_token
                          ? "••••••••"
                          : "No token set"
                      }
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="p-6 mt-auto bg-muted/5 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Last Updated</span>
              <span className="font-mono uppercase text-muted-foreground">
                {connection.updated_at
                  ? formatDistanceToNow(new Date(connection.updated_at), {
                      addSuffix: true,
                    })
                  : "Unknown"}
              </span>
            </div>

            {form.formState.isDirty && (
              <Button type="submit" className="w-full" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}

function ToolsList({
  tools,
  connectionId,
  org,
}: {
  tools: { name: string; description?: string }[];
  connectionId: string;
  org: string;
}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  const filteredTools = useMemo(() => {
    if (!search.trim()) return tools;
    const searchLower = search.toLowerCase();
    return tools
      .filter(
        (t) =>
          t.name.toLowerCase().includes(searchLower) ||
          (t.description && t.description.toLowerCase().includes(searchLower)),
      )
      .map((t) => ({ ...t, id: t.name })); // Ensure ID exists
  }, [tools, search]);

  const columns = [
    {
      id: "name",
      header: "NAME",
      render: (tool: { name: string }) => (
        <div className="font-medium font-mono text-sm">{tool.name}</div>
      ),
      sortable: true,
    },
    {
      id: "description",
      header: "DESCRIPTION",
      render: (tool: { description?: string }) => (
        <div className="text-muted-foreground text-sm line-clamp-1">
          {tool.description}
        </div>
      ),
    },
  ];

  return (
    <CollectionsList
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data={filteredTools as any[]}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      search={search}
      onSearchChange={setSearch}
      columns={columns}
      onItemClick={(tool) => {
        navigate({
          to: `/${org}/mcps/${connectionId}/tools/${encodeURIComponent(tool.name)}`,
        });
      }}
      renderCard={(tool) => (
        <Card className="p-4">
          <div className="font-medium">{tool.name}</div>
          <div className="text-sm text-muted-foreground">
            {tool.description}
          </div>
        </Card>
      )}
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
  org,
  schema: jsonSchema,
}: {
  connectionId: string;
  collectionName: string;
  org: string;
  schema?: Record<string, unknown>;
}) {
  const navigate = useNavigate();

  const collection = useCollection(connectionId, collectionName);

  const {
    search,
    searchTerm,
    setSearch,
    viewMode,
    setViewMode,
    sortKey,
    sortDirection,
    handleSort,
  } = useListState<BaseCollectionEntity>({
    namespace: org,
    resource: `${connectionId}-${collectionName}`,
    defaultSortKey: "updated_at",
  });

  const { data: items, isLoading } = useCollectionList(collection, {
    searchTerm,
    sortKey,
    sortDirection,
  });

  const schema = useMemo(
    () =>
      jsonSchema
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (jsonSchemaToZod(jsonSchema as any) as z.ZodObject<any>)
        : undefined,
    [jsonSchema],
  );

  const handleAction = async (
    action: "open" | "delete" | "duplicate" | "edit",
    item: BaseCollectionEntity,
  ) => {
    switch (action) {
      case "open":
        navigate({
          to: `/${org}/mcps/${connectionId}/${encodeURIComponent(collectionName)}/${encodeURIComponent(item.id)}`,
        });
        break;
      case "delete":
        if (confirm("Are you sure you want to delete this item?")) {
          await collection.delete(item.id);
          toast.success("Item deleted");
        }
        break;
      case "duplicate": {
        const {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          id: _id,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          created_at: _created_at,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          updated_at: _updated_at,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          created_by: _created_by,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          updated_by: _updated_by,
          ...rest
        } = item as unknown as Record<string, unknown>;

        await collection.insert({
          ...rest,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          title: `${(rest as any).title} (Copy)`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        toast.success("Item duplicated");
        break;
      }
      case "edit":
        // Default edit is same as open for now if we don't have inline edit
        navigate({
          to: `/${org}/mcps/${connectionId}/${encodeURIComponent(collectionName)}/${encodeURIComponent(item.id)}`,
        });
        break;
    }
  };

  return (
    <CollectionsList
      data={items ?? []}
      schema={schema}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      search={search}
      onSearchChange={setSearch}
      sortKey={sortKey as string}
      sortDirection={sortDirection}
      onSort={handleSort}
      onAction={handleAction}
      onItemClick={(item) => handleAction("open", item)}
      isLoading={isLoading}
      emptyState={
        <div className="text-center py-12 text-muted-foreground">
          {search ? "No items found matching search" : "No items found"}
        </div>
      }
    />
  );
}

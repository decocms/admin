import { createToolCaller } from "@/tools/client";
import type { ConnectionEntity } from "@/tools/connection/schema";
import { ConnectionEntitySchema } from "@/tools/connection/schema";
import { AddToCursorButton } from "@/web/components/add-to-cursor-button.tsx";
import { CollectionDisplayButton } from "@/web/components/collections/collection-display-button.tsx";
import { CollectionSearch } from "@/web/components/collections/collection-search.tsx";
import { CollectionTableWrapper } from "@/web/components/collections/collection-table-wrapper.tsx";
import {
  CollectionsList,
  generateSortOptionsFromSchema,
} from "@/web/components/collections/collections-list.tsx";
import { EmptyState } from "@/web/components/empty-state.tsx";
import { ErrorBoundary } from "@/web/components/error-boundary";
import { BaseCollectionJsonSchema, TOOL_CONNECTION_CONFIGURE } from "@/web/utils/constants";
import { IntegrationIcon } from "@/web/components/integration-icon.tsx";
import {
  CONNECTIONS_COLLECTION,
  useConnection,
} from "@/web/hooks/collections/use-connection";
import {
  useBindingConnections,
  useCollectionBindings,
} from "@/web/hooks/use-binding";
import { useCollection, useCollectionList } from "@/web/hooks/use-collections";
import { useListState } from "@/web/hooks/use-list-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@deco/ui/components/alert-dialog.tsx";
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
import type { BaseCollectionEntity } from "@decocms/bindings/collections";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Lock, Plus } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useMcp } from "use-mcp/react";
import { z } from "zod";
import { authClient } from "@/web/lib/auth-client";
import { ViewLayout, ViewTabs, ViewActions } from "./layout";
import { McpConfigurationForm } from "./mcp-configuration-form";

function ConnectionInspectorViewContent() {
  const { connectionId, org } = useParams({ strict: false });
  const navigate = useNavigate({ from: "/$org/mcps/$connectionId" });

  // We can use search params for active tab if we want persistent tabs
  const search = useSearch({ strict: false }) as { tab?: string };
  const activeTabId = search.tab || "settings";

  const connection = useConnection(connectionId);
  const connectionsCollection = CONNECTIONS_COLLECTION;

  // Detect collection bindings
  const collections = useCollectionBindings(connection);

  // Detect MCP binding
  const mcpBindingConnections = useBindingConnections(
    connection ? [connection] : [],
    "MCP",
  );
  const hasMcpBinding = mcpBindingConnections.length > 0;

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
    { id: "settings", label: "Settings" },
    { id: "tools", label: "Tools", count: mcp.tools?.length ?? 0 },
    ...(collections || []).map((c) => ({ id: c.name, label: c.displayName })),
  ];

  const handleTabChange = (tabId: string) => {
    navigate({ search: (prev) => ({ ...prev, tab: tabId }), replace: true });
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
        <div className="flex-1 flex flex-col min-w-0 bg-background overflow-auto">
          {mcp.state === "pending_auth" ||
          mcp.state === "authenticating" ||
          (!connection.connection_token && mcp.state === "failed") ? (
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
          ) : activeTabId === "settings" ? (
            <div className="flex-1">
              <SettingsTab
                connection={connection}
                onUpdate={handleUpdateConnection}
                hasMcpBinding={hasMcpBinding}
              />
            </div>
          ) : (
            <ErrorBoundary>
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                }
              >
                <CollectionContent
                  key={activeTabId}
                  connectionId={connectionId as string}
                  collectionName={activeTabId}
                  org={org as string}
                  schema={activeCollection?.schema}
                  hasCreateTool={activeCollection?.hasCreateTool ?? false}
                  hasUpdateTool={activeCollection?.hasUpdateTool ?? false}
                  hasDeleteTool={activeCollection?.hasDeleteTool ?? false}
                />
              </Suspense>
            </ErrorBoundary>
          )}
        </div>
      </div>
    </ViewLayout>
  );
}

export default function ConnectionInspectorView() {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <ConnectionInspectorViewContent />
      </Suspense>
    </ErrorBoundary>
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

interface SettingsTabProps {
  connection: ConnectionEntity;
  onUpdate: (connection: Partial<ConnectionEntity>) => Promise<void>;
  hasMcpBinding: boolean;
}

function SettingsTab({
  connection,
  onUpdate,
  hasMcpBinding,
}: SettingsTabProps) {
  const [isSavingConnection, setIsSavingConnection] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Connection settings form
  const connectionForm = useForm<ConnectionFormData>({
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
  // oxlint-disable-next-line ban-use-effect/ban-use-effect
  useEffect(() => {
    connectionForm.reset({
      title: connection.title,
      description: connection.description,
      connection_type: connection.connection_type,
      connection_url: connection.connection_url,
      connection_token: connection.connection_token,
    });
  }, [connection, connectionForm]);

  // MCP config state
  const [mcpFormState, setMcpFormState] = useState<Record<string, unknown>>(
    connection.configuration_state ?? {},
  );
  const [mcpInitialState, setMcpInitialState] = useState<
    Record<string, unknown>
  >(connection.configuration_state ?? {});
  const [mcpScopes] = useState<string[]>(connection.configuration_scopes ?? []);

  // Reset MCP state when connection changes
  // oxlint-disable-next-line ban-use-effect/ban-use-effect
  useEffect(() => {
    if (connection.configuration_state) {
      setMcpFormState(connection.configuration_state);
      setMcpInitialState(connection.configuration_state);
    }
  }, [connection]);

  // Track if MCP config has changes
  const mcpHasChanges = useMemo(() => {
    return JSON.stringify(mcpFormState) !== JSON.stringify(mcpInitialState);
  }, [mcpFormState, mcpInitialState]);

  const handleSaveConnection = async () => {
    const isValid = await connectionForm.trigger();
    if (!isValid) return;

    setIsSavingConnection(true);
    try {
      const data = connectionForm.getValues();
      await onUpdate({
        ...data,
        description: data.description || null,
        connection_token: data.connection_token || null,
      });
      connectionForm.reset(data);
      toast.success("Connection updated successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to update connection: ${message}`);
    } finally {
      setIsSavingConnection(false);
    }
  };

  const handleSaveMcpConfig = async () => {
    setIsSavingConfig(true);
    try {
      const meshToolCaller = createToolCaller();
      await meshToolCaller(TOOL_CONNECTION_CONFIGURE, {
        connectionId: connection.id,
        scopes: mcpScopes,
        state: mcpFormState,
      });
      
      // Update local collection to keep cache in sync
      const tx = CONNECTIONS_COLLECTION.update(connection.id, (draft) => {
        draft.configuration_state = mcpFormState;
        draft.configuration_scopes = mcpScopes;
      });
      await tx.isPersisted.promise;
      
      setMcpInitialState(mcpFormState);
      
      toast.success("Configuration saved successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to save configuration: ${message}`);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const isSaving = isSavingConnection || isSavingConfig;
  const hasConnectionChanges = connectionForm.formState.isDirty;
  const hasAnyChanges = hasConnectionChanges || mcpHasChanges;

  return (
    <>
      {hasAnyChanges && (
        <ViewActions>
          <Button
            onClick={() => {
              if (hasConnectionChanges) {
                handleSaveConnection();
              }
              if (mcpHasChanges) {
                handleSaveMcpConfig();
              }
            }}
            disabled={isSaving}
            size="sm"
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </ViewActions>
      )}

      <div className="flex h-full">
        {/* Left sidebar - Connection Settings (2/5) */}
        <div className="w-2/5 shrink-0 border-r border-border overflow-auto">
          <ConnectionSettingsFormUI
            form={connectionForm}
            connection={connection}
          />
        </div>

        {/* Right panel - MCP Configuration (3/5) */}
        {hasMcpBinding && (
          <div className="w-3/5 min-w-0 overflow-auto">
            <McpConfigurationForm
              connection={connection}
              formState={mcpFormState}
              onFormStateChange={setMcpFormState}
              isSaving={isSavingConfig}
            />
          </div>
        )}
      </div>
    </>
  );
}

function ConnectionSettingsFormUI({
  form,
  connection,
}: {
  form: ReturnType<typeof useForm<ConnectionFormData>>;
  connection: ConnectionEntity;
}) {
  return (
    <Form {...form}>
      <div className="flex flex-col">
        {/* Header section - Icon, Title, Description */}
        <div className="flex flex-col gap-4 p-5 border-b border-border">
          <IntegrationIcon
            icon={connection.icon}
            name={connection.title}
            size="lg"
            className="shadow-sm"
          />
          <div className="flex flex-col">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem className="w-full space-y-0">
                  <div className="flex items-center gap-2.5">
                    <FormControl>
                      <Input
                        {...field}
                        className="h-auto! text-xl! font-medium! leading-7! px-0 border-transparent hover:border-input focus:border-input bg-transparent transition-all"
                        placeholder="Connection Name"
                      />
                    </FormControl>
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
                      className="h-auto! text-base! text-muted-foreground! leading-6! px-0 border-transparent hover:border-input focus:border-input bg-transparent transition-all"
                      placeholder="Add a description..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Connection section */}
        <div className="flex flex-col gap-4 p-5 border-b border-border">
          <div className="flex flex-col gap-2">
            <FormLabel className="text-sm font-medium">Connection</FormLabel>
            <div className="flex">
              <FormField
                control={form.control}
                name="connection_type"
                render={({ field }) => (
                  <FormItem className="space-y-0">
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-10 rounded-r-none border-r-0 bg-muted focus:ring-0 focus:ring-offset-0 rounded-l-lg">
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
                        className="h-10 rounded-l-none rounded-r-xl focus-visible:ring-0 focus-visible:ring-offset-0"
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
              <FormItem className="flex flex-col gap-2">
                <FormLabel className="text-sm font-medium">Token</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder={connection.connection_token ? "••••••••" : ""}
                    {...field}
                    value={field.value || ""}
                    className="h-10 rounded-lg"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Last Updated section */}
        <div className="flex items-center gap-4 p-5 border-b border-border">
          <span className="flex-1 text-sm text-foreground">Last Updated</span>
          <span className="font-mono text-sm uppercase text-muted-foreground">
            {connection.updated_at
              ? formatDistanceToNow(new Date(connection.updated_at), {
                  addSuffix: false,
                })
              : "Unknown"}
          </span>
        </div>
      </div>
      <CursorIDEIntegration connection={connection} />
    </Form>
  );
}

function CursorIDEIntegration({
  connection,
}: {
  connection: ConnectionEntity;
}) {
  // Generate MCP config for Cursor - uses Mesh proxy URL
  const mcpConfig = useMemo(() => {
    // Get the base URL (current window origin)
    const baseUrl = window.location.origin;

    // Build the Mesh proxy URL: {baseUrl}/mcp/{connectionId}
    const proxyUrl = `${baseUrl}/mcp/${connection.id}`;

    return {
      url: proxyUrl,
    };
  }, [connection.id]);

  return (
    <div className="space-y-4 p-5">
      <div>
        <h4 className="text-sm font-medium text-foreground mb-1">
          Install in Cursor IDE
        </h4>
        <p className="text-sm text-muted-foreground">
          Add this MCP server to Cursor via the Mesh HTTP proxy. Authentication
          and permissions are handled automatically through Mesh.
        </p>
      </div>
      <AddToCursorButton
        serverName={connection.title || `mcp-${connection.id.slice(0, 8)}`}
        config={mcpConfig}
        variant="default"
      />
    </div>
  );
}

function ToolsList({
  tools,
  connectionId,
  org,
}: {
  tools: Array<{ name: string; description?: string }> | undefined;
  connectionId: string;
  org: string;
}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [sortKey, setSortKey] = useState<string | undefined>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>(
    "asc",
  );

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((prev) =>
        prev === "asc" ? "desc" : prev === "desc" ? null : "asc",
      );
      if (sortDirection === "desc") setSortKey(undefined);
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const filteredTools = useMemo(() => {
    if (!tools || tools.length === 0) return [];
    if (!search.trim()) return tools;
    const searchLower = search.toLowerCase();
    return tools.filter(
      (t) =>
        t.name.toLowerCase().includes(searchLower) ||
        (t.description && t.description.toLowerCase().includes(searchLower)),
    );
  }, [tools, search]);

  const sortedTools = useMemo(() => {
    if (!sortKey || !sortDirection) return filteredTools;

    return [...filteredTools].sort((a, b) => {
      const aVal = (a as unknown as Record<string, unknown>)[sortKey] || "";
      const bVal = (b as unknown as Record<string, unknown>)[sortKey] || "";
      const comparison = String(aVal).localeCompare(String(bVal));
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredTools, sortKey, sortDirection]);

  const columns = [
    {
      id: "name",
      header: "Name",
      render: (tool: { name: string }) => (
        <span className="text-sm font-medium font-mono text-foreground">
          {tool.name}
        </span>
      ),
      sortable: true,
    },
    {
      id: "description",
      header: "Description",
      render: (tool: { description?: string }) => (
        <span className="text-sm text-foreground">
          {tool.description || "—"}
        </span>
      ),
      cellClassName: "flex-1",
      sortable: true,
    },
  ];

  const sortOptions = columns
    .filter((col) => col.sortable)
    .map((col) => ({
      id: col.id,
      label: typeof col.header === "string" ? col.header : col.id,
    }));

  return (
    <>
      <ViewActions>
        <CollectionDisplayButton
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={handleSort}
          sortOptions={sortOptions}
        />
      </ViewActions>

      <div className="flex flex-col h-full overflow-hidden">
        {/* Search */}
        <CollectionSearch
          value={search}
          onChange={setSearch}
          placeholder="Search tools..."
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setSearch("");
              (event.target as HTMLInputElement).blur();
            }
          }}
        />

        {/* Content: Cards or Table */}
        {viewMode === "cards" ? (
          <div className="flex-1 overflow-auto p-5">
            {sortedTools.length === 0 ? (
              <EmptyState
                image={null}
                title={search ? "No tools found" : "No tools available"}
                description={
                  search
                    ? "Try adjusting your search terms"
                    : "This connection doesn't have any tools yet."
                }
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {sortedTools.map((tool) => (
                  <Card
                    key={tool.name}
                    className="cursor-pointer transition-colors"
                    onClick={() =>
                      navigate({
                        to: "/$org/mcps/$connectionId/$collectionName/$itemId",
                        params: {
                          org: org ?? "",
                          connectionId: connectionId ?? "",
                          collectionName: "tools",
                          itemId: encodeURIComponent(tool.name),
                        },
                      })
                    }
                  >
                    <div className="flex flex-col gap-4 p-6">
                      <IntegrationIcon
                        icon={null}
                        name={tool.name}
                        size="md"
                        className="shrink-0 shadow-sm"
                      />
                      <div className="flex flex-col gap-0">
                        <h3 className="text-base font-medium text-foreground truncate">
                          {tool.name}
                        </h3>
                        <p className="text-base text-muted-foreground line-clamp-2">
                          {tool.description || "No description"}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : (
          <CollectionTableWrapper
            columns={columns}
            data={sortedTools}
            isLoading={false}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
            onRowClick={(tool: { name: string; description?: string }) =>
              navigate({
                to: "/$org/mcps/$connectionId/$collectionName/$itemId",
                params: {
                  org: org ?? "",
                  connectionId: connectionId ?? "",
                  collectionName: "tools",
                  itemId: encodeURIComponent(tool.name),
                },
              })
            }
            emptyState={
              <EmptyState
                image={null}
                title={search ? "No tools found" : "No tools available"}
                description={
                  search
                    ? "Try adjusting your search terms"
                    : "This connection doesn't have any tools yet."
                }
              />
            }
          />
        )}
      </div>
    </>
  );
}

function CollectionContent({
  connectionId,
  collectionName,
  org,
  schema = BaseCollectionJsonSchema,
  hasCreateTool,
  hasUpdateTool,
  hasDeleteTool,
}: {
  connectionId: string;
  collectionName: string;
  org: string;
  schema?: Record<string, unknown>;
  hasCreateTool: boolean;
  hasUpdateTool: boolean;
  hasDeleteTool: boolean;
}) {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id || "unknown";

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

  const items =
    useCollectionList(collection, {
      searchTerm,
      sortKey,
      sortDirection,
    }) ?? [];

  // Collection is read-only if ALL mutation tools are missing
  const isReadOnly = !hasCreateTool && !hasUpdateTool && !hasDeleteTool;

  // Create action handlers
  const handleEdit = (item: BaseCollectionEntity) => {
    navigate({
      to: "/$org/mcps/$connectionId/$collectionName/$itemId",
      params: {
        org,
        connectionId,
        collectionName,
        itemId: item.id,
      },
    });
  };

  const handleDuplicate = (item: BaseCollectionEntity) => {
    const now = new Date().toISOString();
    collection.insert({
      ...item,
      id: crypto.randomUUID(),
      title: `${item.title} (Copy)`,
      created_at: now,
      updated_at: now,
      created_by: userId,
      updated_by: userId,
    });
    toast.success("Item duplicated");
  };

  const [itemToDelete, setItemToDelete] = useState<BaseCollectionEntity | null>(
    null,
  );

  const handleDelete = (item: BaseCollectionEntity) => {
    setItemToDelete(item);
  };

  // Build actions object with only available actions
  const actions: Record<string, (item: BaseCollectionEntity) => void> = {
    ...(hasUpdateTool && { edit: handleEdit }),
    ...(hasCreateTool && { duplicate: handleDuplicate }),
    ...(hasDeleteTool && { delete: handleDelete }),
  };

  const confirmDelete = () => {
    if (!itemToDelete) return;
    collection.delete(itemToDelete.id);
    toast.success("Item deleted");
    setItemToDelete(null);
  };

  const handleCreate = async () => {
    if (!hasCreateTool) {
      toast.error("Create operation is not available for this collection");
      return;
    }

    const now = new Date().toISOString();
    const newItem: BaseCollectionEntity = {
      id: crypto.randomUUID(),
      title: "New Item",
      created_at: now,
      updated_at: now,
      created_by: userId,
      updated_by: userId,
    };

    try {
      const tx = collection.insert(newItem);
      await tx.isPersisted.promise;

      toast.success("Item created successfully");
      // Navigate to the new item's detail page
      navigate({
        to: "/$org/mcps/$connectionId/$collectionName/$itemId",
        params: {
          org,
          connectionId,
          collectionName,
          itemId: newItem.id as string,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Failed to create item:", error);
      toast.error(`Failed to create item: ${message}`);
      // Do not navigate on error - optimistic update will be rolled back automatically
    }
  };

  // Generate sort options from schema
  const sortOptions = generateSortOptionsFromSchema(schema);

  const hasItems = (items?.length ?? 0) > 0;
  const showCreateInToolbar = hasCreateTool && hasItems;
  const showCreateInEmptyState = hasCreateTool && !hasItems && !search;

  const createButton = hasCreateTool ? (
    <Button onClick={handleCreate} size="sm">
      <Plus className="mr-2 h-4 w-4" />
      Create
    </Button>
  ) : null;

  return (
    <>
      <ViewActions>
        <CollectionDisplayButton
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          sortKey={sortKey as string}
          sortDirection={sortDirection}
          onSort={handleSort}
          sortOptions={sortOptions}
        />
        {showCreateInToolbar && createButton}
      </ViewActions>

      <div className="flex flex-col h-full overflow-hidden">
        {/* Search */}
        <CollectionSearch
          value={search}
          onChange={setSearch}
          placeholder={`Search ${collectionName}...`}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setSearch("");
              (event.target as HTMLInputElement).blur();
            }
          }}
        />

        {/* Collections List with schema-based rendering */}
        <div className="flex-1 overflow-auto">
          <CollectionsList
            hideToolbar
            data={items ?? []}
            schema={schema}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            search={search}
            onSearchChange={setSearch}
            sortKey={sortKey as string}
            sortDirection={sortDirection}
            onSort={handleSort}
            actions={actions}
            onItemClick={(item) => handleEdit(item)}
            readOnly={isReadOnly}
            emptyState={
              <EmptyState
                image={null}
                title={search ? "No items found" : "No items found"}
                description={
                  search
                    ? "Try adjusting your search terms"
                    : "This collection doesn't have any items yet."
                }
                actions={showCreateInEmptyState ? createButton : undefined}
              />
            }
          />
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!itemToDelete}
        onOpenChange={(open) => {
          if (!open) {
            setItemToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete item?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{itemToDelete?.title}"? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

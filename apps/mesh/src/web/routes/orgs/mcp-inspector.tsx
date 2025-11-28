import { createToolCaller } from "@/tools/client";
import { CollectionItemsList } from "@/web/components/collection-items-list";
import {
  useCollectionBindings,
  useConnection,
  useConnectionsCollection,
  type ConnectionEntity,
} from "@/web/hooks/collections/use-connection";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@deco/ui/components/accordion.tsx";
import { Alert, AlertDescription } from "@deco/ui/components/alert.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@deco/ui/components/card.tsx";
import { Label } from "@deco/ui/components/label.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@deco/ui/components/tabs.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { useParams } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  PlayCircle,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useMcp, type Tool } from "use-mcp/react";

function getStatusBadgeInfo(state: string) {
  switch (state) {
    case "ready":
      return {
        variant: "default" as const,
        icon: CheckCircle2,
        text: "Connected",
      };
    case "failed":
      return {
        variant: "destructive" as const,
        icon: AlertCircle,
        text: "Failed",
      };
    case "authenticating":
      return {
        variant: "secondary" as const,
        icon: Loader2,
        text: "Authenticating",
      };
    case "connecting":
    case "loading":
      return {
        variant: "secondary" as const,
        icon: Loader2,
        text: "Connecting",
      };
    case "discovering":
      return {
        variant: "secondary" as const,
        icon: Loader2,
        text: "Discovering",
      };
    default:
      return { variant: "outline" as const, icon: AlertCircle, text: state };
  }
}

export default function McpInspector() {
  const { connectionId } = useParams({ strict: false });
  const { data, isLoading: isLoadingConnection } = useConnection(connectionId);
  const connectionsCollection = useConnectionsCollection();
  const connection = data?.[0] as ConnectionEntity | undefined;

  // Detect collection bindings via server-side tool
  const { collections, isLoading: isLoadingCollections } =
    useCollectionBindings(connectionId as string | undefined);

  // Tool invocation state
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [toolArgs, setToolArgs] = useState<string>("{}");
  const [toolResult, setToolResult] = useState<unknown>(null);
  const [isInvokingTool, setIsInvokingTool] = useState(false);
  const [toolError, setToolError] = useState<string | null>(null);

  // Copy state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Normalize the connection URL by removing the i: prefix
  // This is needed because deco.cx integration URLs use i:<uuid> pattern
  // but the MCP server expects the URL without the i: prefix
  const normalizeUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      // Remove /i: pattern from the pathname (e.g., /i:01045c1a-... -> /01045c1a-...)
      parsed.pathname = parsed.pathname.replace(/\/i:([a-f0-9-]+)/gi, "/$1");
      return parsed.toString();
    } catch {
      return url;
    }
  };

  // Initialize MCP connection
  const normalizedUrl = connection?.connection_url
    ? normalizeUrl(connection.connection_url)
    : "";

  // Use a consistent storage prefix for all connections
  // The server URL hash will differentiate between different servers
  const mcp = useMcp({
    url: normalizedUrl,
    clientName: "MCP Mesh Inspector",
    clientUri: window.location.origin,
    callbackUrl: `${window.location.origin}/oauth/callback`,
    debug: true,
    autoReconnect: true,
    autoRetry: 5000,
    onPopupWindow: (_url, _features, popupWindow) => {
      // Capture snapshot of localStorage tokens BEFORE OAuth flow
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

      // Store connection context for OAuth callback to use
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

      // Listen for messages from the OAuth popup
      const messageHandler = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;

        // Handle OAuth completion message
        if (event.data.type === "mcp:oauth:complete") {
          if (event.data.success && connection && connectionId) {
            try {
              // Capture snapshot AFTER OAuth and find the diff
              const tokenSnapshotAfter = captureTokenSnapshot("mcp:auth");

              // Find new or changed tokens
              let newOrChangedToken: string | null = null;

              for (const [key, value] of tokenSnapshotAfter) {
                const beforeValue = tokenSnapshotBefore.get(key);
                if (!beforeValue || beforeValue !== value) {
                  // This is a new or changed token

                  // Extract the actual token from the stored value
                  try {
                    const parsed = JSON.parse(value);
                    newOrChangedToken =
                      parsed.access_token || parsed.accessToken || value;
                  } catch {
                    newOrChangedToken = value;
                  }
                  break; // Use the first new/changed token found
                }
              }

              if (newOrChangedToken) {
                if (!connectionsCollection.has(connectionId as string)) {
                  throw new Error("Connection not found in collection");
                }

                // Call collection.update to save the token
                const tx = connectionsCollection.update(
                  connectionId as string,
                  (draft) => {
                    draft.connection_type = connection.connection_type;
                    draft.connection_url = connection.connection_url;
                    draft.connection_token = newOrChangedToken;
                  },
                );
                await tx.isPersisted.promise;
              }

              // Clear pending auth from storage
              localStorage.removeItem("mcp_oauth_pending");
            } catch (saveErr) {
              toast.error(
                `Failed to save token: ${saveErr instanceof Error ? saveErr.message : String(saveErr)}`,
              );
            }

            // Close the popup after saving
            if (popupWindow && !popupWindow.closed) {
              popupWindow.close();
            }
            window.removeEventListener("message", messageHandler);
          } else if (!event.data.success) {
            toast.error(`OAuth failed: ${event.data.error || "Unknown error"}`);
            // Close popup on error
            if (popupWindow && !popupWindow.closed) {
              popupWindow.close();
            }
            window.removeEventListener("message", messageHandler);
          }
        }
      };

      window.addEventListener("message", messageHandler);

      // Cleanup after 5 minutes
      setTimeout(
        () => {
          window.removeEventListener("message", messageHandler);
        },
        5 * 60 * 1000,
      );
    },
  });

  const statusBadge = getStatusBadgeInfo(mcp.state);
  const StatusIcon = statusBadge.icon;

  const handleInvokeTool = async () => {
    if (!selectedTool || !connectionId) return;

    setIsInvokingTool(true);
    setToolError(null);
    setToolResult(null);

    try {
      const args = JSON.parse(toolArgs);
      const callTool = createToolCaller(connectionId as string);
      const result = await callTool(selectedTool.name, args);
      setToolResult(result);
    } catch (error) {
      setToolError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsInvokingTool(false);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoadingConnection) {
    return (
      <div className="container max-w-7xl mx-auto py-6 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="container max-w-7xl mx-auto py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Connection not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  // Calculate the number of tab columns (Tools + collections)
  const tabCount = 1 + collections.length;

  return (
    <div className="container max-w-7xl mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">MCP Inspector</h1>
            <p className="text-muted-foreground">{connection.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusBadge.variant} className="gap-1.5">
            <StatusIcon
              className={`h-3.5 w-3.5 ${statusBadge.icon === Loader2 ? "animate-spin" : ""}`}
            />
            {statusBadge.text}
          </Badge>
        </div>
      </div>

      {/* Connection Info */}
      <Card>
        <CardHeader>
          <CardTitle>Connection Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-muted-foreground">Type:</div>
            <div className="font-medium">{connection.connection_type}</div>
            <div className="text-muted-foreground">URL:</div>
            <div className="font-mono text-xs break-all">
              {connection.connection_url}
            </div>
            {normalizedUrl !== connection.connection_url && (
              <>
                <div className="text-muted-foreground">Normalized URL:</div>
                <div className="font-mono text-xs break-all text-blue-600">
                  {normalizedUrl}
                  <Badge variant="outline" className="ml-2 text-xs">
                    i: prefix removed
                  </Badge>
                </div>
              </>
            )}
            <div className="text-muted-foreground">Status:</div>
            <div className="font-medium">{connection.status}</div>
            {collections.length > 0 && (
              <>
                <div className="text-muted-foreground">Collections:</div>
                <div className="flex flex-wrap gap-1">
                  {collections.map((col) => (
                    <Badge
                      key={col.name}
                      variant="secondary"
                      className="text-xs"
                    >
                      {col.displayName}
                    </Badge>
                  ))}
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {mcp.state === "failed" && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Connection failed: {mcp.error}</span>
            <div className="flex gap-2">
              {mcp.authUrl && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(mcp.authUrl, "_blank")}
                >
                  Authenticate
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={mcp.retry}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Retry
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {(mcp.state === "connecting" ||
        mcp.state === "loading" ||
        mcp.state === "discovering" ||
        mcp.state === "pending_auth") && (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertDescription>
            {mcp.state === "pending_auth"
              ? "Authentication required..."
              : "Connecting to MCP server..."}
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content - Only show when ready */}
      {mcp.state === "ready" && (
        <Tabs defaultValue="tools" className="space-y-4">
          <TabsList
            className="w-full"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${tabCount}, 1fr)`,
            }}
          >
            <TabsTrigger value="tools">Tools ({mcp.tools.length})</TabsTrigger>
            {collections.map((collection) => (
              <TabsTrigger
                key={collection.name}
                value={`collection-${collection.name}`}
              >
                {collection.displayName}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Tools Tab */}
          <TabsContent value="tools" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Tool List */}
              <Card>
                <CardHeader>
                  <CardTitle>Available Tools</CardTitle>
                  <CardDescription>
                    Select a tool to view details and invoke
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {mcp.tools.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No tools available
                    </div>
                  ) : (
                    <ScrollArea className="h-[500px] pr-4">
                      <Accordion type="single" collapsible className="w-full">
                        {mcp.tools.map((tool) => (
                          <AccordionItem key={tool.name} value={tool.name}>
                            <AccordionTrigger className="hover:no-underline">
                              <div className="flex items-center justify-between w-full pr-2">
                                <span className="font-mono text-sm">
                                  {tool.name}
                                </span>
                                <Button
                                  size="sm"
                                  variant={
                                    selectedTool?.name === tool.name
                                      ? "default"
                                      : "ghost"
                                  }
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedTool(tool);
                                    setToolError(null);
                                    setToolResult(null);
                                    // Pre-populate with default values if available
                                    if (tool.inputSchema?.properties) {
                                      const defaults: Record<string, unknown> =
                                        {};
                                      Object.entries(
                                        tool.inputSchema.properties,
                                      ).forEach(([key, schema]) => {
                                        if (
                                          typeof schema === "object" &&
                                          schema !== null &&
                                          "default" in schema &&
                                          schema.default !== undefined
                                        ) {
                                          defaults[key] = schema.default;
                                        }
                                      });
                                      setToolArgs(
                                        JSON.stringify(defaults, null, 2),
                                      );
                                    } else {
                                      setToolArgs("{}");
                                    }
                                  }}
                                >
                                  Select
                                </Button>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-2 text-sm pt-2">
                                {tool.description && (
                                  <p className="text-muted-foreground">
                                    {tool.description}
                                  </p>
                                )}
                                {tool.inputSchema && (
                                  <div>
                                    <h4 className="font-semibold mb-1">
                                      Input Schema:
                                    </h4>
                                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                                      {JSON.stringify(
                                        tool.inputSchema,
                                        null,
                                        2,
                                      )}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              {/* Tool Invocation */}
              <Card>
                <CardHeader>
                  <CardTitle>Invoke Tool</CardTitle>
                  <CardDescription>
                    {selectedTool ? (
                      <>
                        Invoking{" "}
                        <span className="font-mono">{selectedTool.name}</span>
                      </>
                    ) : (
                      "Select a tool to invoke"
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedTool ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="tool-args">Arguments (JSON)</Label>
                        <Textarea
                          id="tool-args"
                          value={toolArgs}
                          onChange={(e) => setToolArgs(e.target.value)}
                          placeholder='{"key": "value"}'
                          className="font-mono text-sm"
                          rows={8}
                        />
                      </div>

                      <Button
                        onClick={handleInvokeTool}
                        disabled={isInvokingTool}
                        className="w-full"
                      >
                        {isInvokingTool ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Invoking...
                          </>
                        ) : (
                          <>
                            <PlayCircle className="h-4 w-4 mr-2" />
                            Invoke Tool
                          </>
                        )}
                      </Button>

                      {toolError && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>{toolError}</AlertDescription>
                        </Alert>
                      )}

                      {toolResult && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Result</Label>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                copyToClipboard(
                                  JSON.stringify(toolResult, null, 2),
                                  "tool-result",
                                )
                              }
                            >
                              {copiedId === "tool-result" ? (
                                <Check className="h-3.5 w-3.5" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                          <ScrollArea className="h-[300px]">
                            <pre className="text-xs bg-muted p-4 rounded">
                              {JSON.stringify(toolResult, null, 2)}
                            </pre>
                          </ScrollArea>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      No tool selected
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Dynamic Collection Tabs */}
          {collections.map((collection) => (
            <TabsContent
              key={collection.name}
              value={`collection-${collection.name}`}
              className="space-y-4"
            >
              <Card>
                <CardHeader>
                  <CardTitle>{collection.displayName}</CardTitle>
                  <CardDescription>
                    Items from the {collection.displayName.toLowerCase()}{" "}
                    collection
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {connectionId && (
                    <CollectionItemsList
                      connectionId={connectionId as string}
                      collectionName={collection.name}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Loading Collections State */}
      {isLoadingCollections && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Detecting collection bindings...
        </div>
      )}

      {/* Debug Logs */}
      {mcp.log.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Debug Logs</CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => mcp.clearStorage()}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Clear Storage
            </Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <pre className="text-xs font-mono">
                {mcp.log.map((l, i) => (
                  <div
                    key={i}
                    className={`py-1 ${
                      l.level === "error"
                        ? "text-destructive"
                        : l.level === "warn"
                          ? "text-yellow-600"
                          : "text-muted-foreground"
                    }`}
                  >
                    [{l.level}] {new Date(l.timestamp).toLocaleTimeString()}:{" "}
                    {l.message}
                  </div>
                ))}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

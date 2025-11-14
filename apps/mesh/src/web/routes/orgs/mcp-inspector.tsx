import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/tools/client";
import { useMcp, type Tool, type Resource, type Prompt } from "use-mcp/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@deco/ui/components/card.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@deco/ui/components/tabs.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@deco/ui/components/accordion.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Separator } from "@deco/ui/components/separator.tsx";
import { Label } from "@deco/ui/components/label.tsx";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  PlayCircle,
  ArrowLeft,
  RefreshCw,
  Trash2,
  Copy,
  Check,
} from "lucide-react";
import { Alert, AlertDescription } from "@deco/ui/components/alert.tsx";
import type { MCPConnection } from "@/storage/types";
import { KEYS } from "@/web/lib/query-keys";
import { useProjectContext } from "@/web/providers/project-context-provider";

const useConnection = (connectionId: string) => {
  const { locator } = useProjectContext();
  return useQuery({
    queryKey: KEYS.connection(locator, connectionId),
    queryFn: () => fetcher.CONNECTION_GET({ id: connectionId }),
  });
};

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
  const { data: connectionData, isLoading: isLoadingConnection } =
    useConnection(connectionId as string);
  const connection = connectionData as MCPConnection | undefined;

  // Tool invocation state
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [toolArgs, setToolArgs] = useState<string>("{}");
  const [toolResult, setToolResult] = useState<unknown>(null);
  const [isInvokingTool, setIsInvokingTool] = useState(false);
  const [toolError, setToolError] = useState<string | null>(null);

  // Resource state
  const [selectedResource, setSelectedResource] = useState<Resource | null>(
    null,
  );
  const [resourceContent, setResourceContent] = useState<unknown>(null);
  const [isLoadingResource, setIsLoadingResource] = useState(false);
  const [resourceError, setResourceError] = useState<string | null>(null);

  // Prompt state
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [promptArgs, setPromptArgs] = useState<string>("{}");
  const [promptResult, setPromptResult] = useState<unknown>(null);
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);

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
  const normalizedUrl = connection?.connectionUrl
    ? normalizeUrl(connection.connectionUrl)
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
      console.log(
        `[MCP Inspector] Captured ${tokenSnapshotBefore.size} token(s) before OAuth`,
      );

      // Store connection context for OAuth callback to use
      if (connection && connectionId) {
        localStorage.setItem(
          "mcp_oauth_pending",
          JSON.stringify({
            connectionId: connectionId as string,
            orgId: connection.organizationId,
            connectionType: connection.connectionType,
            connectionUrl: connection.connectionUrl,
            timestamp: Date.now(),
          }),
        );
        console.log(
          "[MCP Inspector] Stored connection context for OAuth callback",
        );
      }

      // Listen for messages from the OAuth popup
      const messageHandler = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;

        // Handle OAuth completion message
        if (event.data.type === "mcp:oauth:complete") {
          console.log(
            "[MCP Inspector] Received OAuth completion message",
            event.data,
          );

          if (event.data.success && connection && connectionId) {
            console.log(
              "[MCP Inspector] OAuth completed successfully, saving token to database",
            );

            try {
              // Capture snapshot AFTER OAuth and find the diff
              const tokenSnapshotAfter = captureTokenSnapshot("mcp:auth");
              console.log(
                `[MCP Inspector] Captured ${tokenSnapshotAfter.size} token(s) after OAuth`,
              );

              // Find new or changed tokens
              let newOrChangedToken: string | null = null;
              let newOrChangedKey: string | null = null;

              for (const [key, value] of tokenSnapshotAfter) {
                const beforeValue = tokenSnapshotBefore.get(key);
                if (!beforeValue || beforeValue !== value) {
                  // This is a new or changed token
                  console.log(
                    `[MCP Inspector] Found ${!beforeValue ? "new" : "changed"} token key: ${key}`,
                  );
                  newOrChangedKey = key;

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
                console.log(
                  `[MCP Inspector] Found new/changed token from key: ${newOrChangedKey}`,
                );

                // Call CONNECTION_UPDATE to save the token
                await fetcher.CONNECTION_UPDATE({
                  id: connectionId as string,
                  connection: {
                    type: connection.connectionType,
                    url: connection.connectionUrl,
                    token: newOrChangedToken,
                  },
                });

                console.log(
                  "[MCP Inspector] Token saved to database successfully",
                );
              } else {
                console.warn(
                  "[MCP Inspector] No new or changed token found in localStorage",
                );
                console.log(
                  "[MCP Inspector] Before keys:",
                  Array.from(tokenSnapshotBefore.keys()),
                );
                console.log(
                  "[MCP Inspector] After keys:",
                  Array.from(tokenSnapshotAfter.keys()),
                );
              }

              // Clear pending auth from storage
              localStorage.removeItem("mcp_oauth_pending");
            } catch (saveErr) {
              console.error(
                "[MCP Inspector] Failed to save token to database:",
                saveErr,
              );
            }

            // Close the popup after saving
            if (popupWindow && !popupWindow.closed) {
              popupWindow.close();
            }
            window.removeEventListener("message", messageHandler);
          } else if (!event.data.success) {
            console.error(
              "[MCP Inspector] OAuth completion failed:",
              event.data.error,
            );
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
    if (!selectedTool || mcp.state !== "ready") return;

    setIsInvokingTool(true);
    setToolError(null);
    setToolResult(null);

    try {
      const args = JSON.parse(toolArgs);
      const result = await mcp.callTool(selectedTool.name, args);
      setToolResult(result);
    } catch (error) {
      setToolError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsInvokingTool(false);
    }
  };

  const handleReadResource = async (resource: Resource) => {
    if (mcp.state !== "ready") return;

    setSelectedResource(resource);
    setIsLoadingResource(true);
    setResourceError(null);
    setResourceContent(null);

    try {
      const content = await mcp.readResource(resource.uri);
      setResourceContent(content);
    } catch (error) {
      setResourceError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingResource(false);
    }
  };

  const handleGetPrompt = async () => {
    if (!selectedPrompt || mcp.state !== "ready") return;

    setIsLoadingPrompt(true);
    setPromptError(null);
    setPromptResult(null);

    try {
      const args = JSON.parse(promptArgs);
      const result = await mcp.getPrompt(selectedPrompt.name, args);
      setPromptResult(result);
    } catch (error) {
      setPromptError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingPrompt(false);
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
            <p className="text-muted-foreground">{connection.name}</p>
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
            <div className="font-medium">{connection.connectionType}</div>
            <div className="text-muted-foreground">URL:</div>
            <div className="font-mono text-xs break-all">
              {connection.connectionUrl}
            </div>
            {normalizedUrl !== connection.connectionUrl && (
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tools">Tools ({mcp.tools.length})</TabsTrigger>
            <TabsTrigger value="resources">
              Resources ({mcp.resources.length + mcp.resourceTemplates.length})
            </TabsTrigger>
            <TabsTrigger value="prompts">
              Prompts ({mcp.prompts.length})
            </TabsTrigger>
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

          {/* Resources Tab */}
          <TabsContent value="resources" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Resource List */}
              <Card>
                <CardHeader>
                  <CardTitle>Available Resources</CardTitle>
                  <CardDescription>
                    Select a resource to view its contents
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {mcp.resources.length === 0 &&
                  mcp.resourceTemplates.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No resources available
                    </div>
                  ) : (
                    <ScrollArea className="h-[500px] pr-4">
                      <div className="space-y-2">
                        {mcp.resources.map((resource) => (
                          <div
                            key={resource.uri}
                            className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() => handleReadResource(resource)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">
                                  {resource.name}
                                </div>
                                {resource.description && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {resource.description}
                                  </p>
                                )}
                                <div className="text-xs text-muted-foreground font-mono mt-1 truncate">
                                  {resource.uri}
                                </div>
                              </div>
                              <Badge
                                variant="outline"
                                className="text-xs shrink-0"
                              >
                                {resource.mimeType || "unknown"}
                              </Badge>
                            </div>
                          </div>
                        ))}

                        {mcp.resourceTemplates.length > 0 && (
                          <>
                            <Separator className="my-4" />
                            <h4 className="text-sm font-semibold mb-2">
                              Resource Templates
                            </h4>
                            {mcp.resourceTemplates.map((template) => (
                              <div
                                key={template.uriTemplate}
                                className="p-3 border rounded-lg bg-muted/30"
                              >
                                <div className="font-medium text-sm">
                                  {template.name}
                                </div>
                                {template.description && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {template.description}
                                  </p>
                                )}
                                <div className="text-xs text-muted-foreground font-mono mt-1">
                                  {template.uriTemplate}
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              {/* Resource Content */}
              <Card>
                <CardHeader>
                  <CardTitle>Resource Content</CardTitle>
                  <CardDescription>
                    {selectedResource ? (
                      <>
                        Reading{" "}
                        <span className="font-mono">
                          {selectedResource.uri}
                        </span>
                      </>
                    ) : (
                      "Select a resource to view"
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingResource ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : resourceError ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{resourceError}</AlertDescription>
                    </Alert>
                  ) : resourceContent ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Contents</Label>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            copyToClipboard(
                              JSON.stringify(resourceContent, null, 2),
                              "resource-content",
                            )
                          }
                        >
                          {copiedId === "resource-content" ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                      <ScrollArea className="h-[500px]">
                        <pre className="text-xs bg-muted p-4 rounded">
                          {JSON.stringify(resourceContent, null, 2)}
                        </pre>
                      </ScrollArea>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      No resource selected
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Prompts Tab */}
          <TabsContent value="prompts" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Prompt List */}
              <Card>
                <CardHeader>
                  <CardTitle>Available Prompts</CardTitle>
                  <CardDescription>
                    Select a prompt to view details and execute
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {mcp.prompts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No prompts available
                    </div>
                  ) : (
                    <ScrollArea className="h-[500px] pr-4">
                      <Accordion type="single" collapsible className="w-full">
                        {mcp.prompts.map((prompt) => (
                          <AccordionItem key={prompt.name} value={prompt.name}>
                            <AccordionTrigger className="hover:no-underline">
                              <div className="flex items-center justify-between w-full pr-2">
                                <span className="font-mono text-sm">
                                  {prompt.name}
                                </span>
                                <Button
                                  size="sm"
                                  variant={
                                    selectedPrompt?.name === prompt.name
                                      ? "default"
                                      : "ghost"
                                  }
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedPrompt(prompt);
                                    setPromptError(null);
                                    setPromptResult(null);
                                    setPromptArgs("{}");
                                  }}
                                >
                                  Select
                                </Button>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-2 text-sm pt-2">
                                {prompt.description && (
                                  <p className="text-muted-foreground">
                                    {prompt.description}
                                  </p>
                                )}
                                {prompt.arguments &&
                                  prompt.arguments.length > 0 && (
                                    <div>
                                      <h4 className="font-semibold mb-1">
                                        Arguments:
                                      </h4>
                                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                        {prompt.arguments.map((arg) => (
                                          <li key={arg.name}>
                                            <span className="font-mono text-xs">
                                              {arg.name}
                                            </span>
                                            {arg.required && (
                                              <Badge
                                                variant="secondary"
                                                className="ml-2 text-xs"
                                              >
                                                required
                                              </Badge>
                                            )}
                                            {arg.description && (
                                              <span className="ml-1">
                                                - {arg.description}
                                              </span>
                                            )}
                                          </li>
                                        ))}
                                      </ul>
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

              {/* Prompt Execution */}
              <Card>
                <CardHeader>
                  <CardTitle>Execute Prompt</CardTitle>
                  <CardDescription>
                    {selectedPrompt ? (
                      <>
                        Executing{" "}
                        <span className="font-mono">{selectedPrompt.name}</span>
                      </>
                    ) : (
                      "Select a prompt to execute"
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedPrompt ? (
                    <>
                      {selectedPrompt.arguments &&
                        selectedPrompt.arguments.length > 0 && (
                          <div className="space-y-2">
                            <Label htmlFor="prompt-args">
                              Arguments (JSON)
                            </Label>
                            <Textarea
                              id="prompt-args"
                              value={promptArgs}
                              onChange={(e) => setPromptArgs(e.target.value)}
                              placeholder='{"key": "value"}'
                              className="font-mono text-sm"
                              rows={8}
                            />
                          </div>
                        )}

                      <Button
                        onClick={handleGetPrompt}
                        disabled={isLoadingPrompt}
                        className="w-full"
                      >
                        {isLoadingPrompt ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Executing...
                          </>
                        ) : (
                          <>
                            <PlayCircle className="h-4 w-4 mr-2" />
                            Execute Prompt
                          </>
                        )}
                      </Button>

                      {promptError && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>{promptError}</AlertDescription>
                        </Alert>
                      )}

                      {promptResult && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Result</Label>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                copyToClipboard(
                                  JSON.stringify(promptResult, null, 2),
                                  "prompt-result",
                                )
                              }
                            >
                              {copiedId === "prompt-result" ? (
                                <Check className="h-3.5 w-3.5" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                          <ScrollArea className="h-[300px]">
                            <pre className="text-xs bg-muted p-4 rounded">
                              {JSON.stringify(promptResult, null, 2)}
                            </pre>
                          </ScrollArea>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      No prompt selected
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
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

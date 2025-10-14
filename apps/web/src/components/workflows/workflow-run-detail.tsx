import { callTool } from "@deco/sdk";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent, CardHeader } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@deco/ui/components/tabs.tsx";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { EmptyState } from "../common/empty-state.tsx";
import { useResourceRoute } from "../resources-v2/route-context.tsx";
import { WorkflowDisplayCanvas } from "../workflow-builder/workflow-display-canvas.tsx";

interface WorkflowRunDetailProps {
  resourceUri: string;
}

function getStatusBadgeVariant(
  status: string,
): "default" | "destructive" | "secondary" | "outline" | "success" {
  if (status === "success" || status === "completed") return "success";
  if (status === "failed" || status === "errored") return "destructive";
  if (status === "running" || status === "in_progress") return "secondary";
  return "outline";
}

function getStatusIcon(status: string) {
  if (status === "success" || status === "completed") {
    return <Icon name="check_circle" size={18} className="text-success" />;
  } else if (status === "failed" || status === "error") {
    return <Icon name="error" size={18} className="text-destructive" />;
  } else if (status === "running") {
    return <Icon name="sync" size={18} className="text-primary" />;
  } else {
    return <Icon name="schedule" size={18} className="text-muted-foreground" />;
  }
}

// JSON viewer component for displaying structured data
function JsonViewer({ data, title }: { data: unknown; title: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  if (data === null || data === undefined) {
    return (
      <div className="text-sm text-muted-foreground italic">
        No {title.toLowerCase()}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCopy}
          className="h-7 text-xs"
        >
          <Icon
            name={copied ? "check" : "content_copy"}
            size={14}
            className="mr-1"
          />
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <ScrollArea className="h-64 rounded-md border bg-muted/30">
        <pre className="p-4 text-xs font-mono">
          {JSON.stringify(data, null, 2)}
        </pre>
      </ScrollArea>
    </div>
  );
}

export function WorkflowRunDetail({ resourceUri }: WorkflowRunDetailProps) {
  const { connection } = useResourceRoute();

  const runQuery = useQuery({
    queryKey: ["workflow-run-read", resourceUri],
    enabled: Boolean(connection && resourceUri),
    queryFn: async () => {
      const result = await callTool(connection!, {
        name: "DECO_RESOURCE_WORKFLOW_RUN_READ",
        arguments: { uri: resourceUri },
      });
      return result.structuredContent as {
        uri: string;
        data: {
          name: string;
          description?: string;
          status: string;
          runId: string;
          workflowURI?: string;
          // Processed status fields from backend
          currentStep?: string;
          stepResults?: Record<string, unknown>;
          finalResult?: unknown;
          partialResult?: unknown;
          error?: string;
          logs?: Array<{
            type: "log" | "warn" | "error";
            content: string;
          }>;
          startTime?: number;
          endTime?: number;
          // Raw workflow status (kept for compatibility)
          workflowStatus?: {
            params?: {
              input?: unknown;
              steps?: unknown[];
              name?: string;
              context?: {
                workspace?: unknown;
                locator?: unknown;
                workflowURI?: string;
                startedBy?: {
                  id: string;
                  email?: string;
                  name?: string;
                };
                startedAt?: string;
              };
            };
            trigger?: { source: string };
            versionId?: string;
            queued?: string;
            start?: string | null;
            end?: string | null;
            success?: boolean | null;
            steps?: Array<{
              name?: string;
              type?: string;
              start?: string | null;
              end?: string | null;
              success?: boolean | null;
              output?: unknown;
              error?: {
                name?: string;
                message?: string;
              } | null;
              attempts?: Array<{
                start?: string;
                end?: string;
                success?: boolean;
                error?: {
                  name?: string;
                  message?: string;
                };
              }>;
              config?: unknown;
            }>;
            error?: {
              name?: string;
              message?: string;
            } | null;
            output?: unknown;
            status?: string;
          };
        };
        created_at?: string;
        updated_at?: string;
      };
    },
    staleTime: 10_000,
    refetchInterval: (q) => {
      const status = q.state.data?.data?.status;
      if (status === "completed" || status === "failed") return false;
      return 2000;
    },
  });

  const workflowUri = runQuery.data?.data?.workflowURI;

  const workflowQuery = useQuery({
    queryKey: ["workflow-read", workflowUri],
    enabled: Boolean(connection && workflowUri),
    queryFn: async () => {
      const result = await callTool(connection!, {
        name: "DECO_RESOURCE_WORKFLOW_READ",
        arguments: { uri: workflowUri! },
      });
      return result.structuredContent as {
        uri: string;
        data?: { name?: string; description?: string };
      };
    },
    staleTime: 60_000,
  });

  const isLoading =
    runQuery.isLoading || (workflowUri && workflowQuery.isLoading);
  const run = runQuery.data;

  // All hooks must be called unconditionally at the top
  const headerTitle = useMemo(
    () => run?.data?.name || "Workflow Run",
    [run?.data?.name],
  );

  const status = run?.data?.status || "unknown";
  const badgeVariant = getStatusBadgeVariant(status);
  const statusIcon = getStatusIcon(status);

  // Calculate duration using timestamps from backend
  const duration = useMemo(() => {
    const startTime = run?.data?.startTime;
    const endTime = run?.data?.endTime;
    if (!startTime) return null;
    const ms = (endTime || Date.now()) - startTime;
    if (ms < 0) return null;
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ${s % 60}s`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m ${s % 60}s`;
  }, [run?.data?.startTime, run?.data?.endTime]);

  // Use processed data directly from backend
  const input = useMemo(
    () => run?.data?.workflowStatus?.params?.input,
    [run?.data?.workflowStatus],
  );
  const output = useMemo(
    () => run?.data?.finalResult,
    [run?.data?.finalResult],
  );
  const error = run?.data?.error;
  const stepResults = run?.data?.stepResults;
  const logs = run?.data?.logs;
  const currentStep = run?.data?.currentStep;

  // Early returns after all hooks
  if (isLoading) {
    return (
      <div className="h-[calc(100vh-12rem)] flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (runQuery.isError || !run) {
    return (
      <EmptyState
        icon="error"
        title="Failed to load workflow run"
        description={(runQuery.error as Error)?.message || "Run not found"}
      />
    );
  }

  return (
    <div className="h-full w-full flex flex-col p-6 gap-6">
      {/* Status Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xl font-semibold">{headerTitle}</span>
              {statusIcon}
              <Badge variant={badgeVariant} className="capitalize">
                {status}
              </Badge>
              {currentStep && (
                <Badge variant="outline" className="text-xs">
                  <Icon name="play_arrow" size={12} className="mr-1" />
                  {currentStep}
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground font-mono flex items-center gap-2">
              <Icon name="key" size={14} />
              {run.data.runId}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Icon
                name="calendar_today"
                size={16}
                className="text-muted-foreground"
              />
              <span className="font-medium">Started:</span>
              <span className="font-mono bg-muted rounded px-2 py-1 text-xs">
                {run.created_at
                  ? new Date(run.created_at).toLocaleString()
                  : "-"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Icon
                name="calendar_today"
                size={16}
                className="text-muted-foreground"
              />
              <span className="font-medium">Ended:</span>
              <span className="font-mono bg-muted rounded px-2 py-1 text-xs">
                {run.updated_at
                  ? new Date(run.updated_at).toLocaleString()
                  : "-"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="timer" size={16} className="text-muted-foreground" />
              <span className="font-medium">Duration:</span>
              <span className="font-mono bg-muted rounded px-2 py-1 text-xs">
                {duration || "-"}
              </span>
            </div>
            {workflowUri && (
              <div className="flex items-center gap-2">
                <Icon
                  name="schema"
                  size={16}
                  className="text-muted-foreground"
                />
                <span className="font-medium">Workflow:</span>
                <span
                  className="truncate text-xs"
                  title={workflowQuery.data?.data?.name || workflowUri}
                >
                  {workflowQuery.data?.data?.name ||
                    workflowUri.split("/").pop()}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Card className="border-destructive">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 text-destructive">
              <Icon name="error" size={18} />
              <span className="font-semibold">Error</span>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="max-h-40">
              <div className="text-sm text-destructive whitespace-pre-wrap p-4 bg-destructive/5 rounded-md">
                {error}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Tabs for different data views */}
      <Card className="flex-1 overflow-hidden">
        <Tabs defaultValue="workflow" className="h-full flex flex-col">
          <CardHeader className="pb-2">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="workflow" className="gap-1.5">
                <Icon name="schema" size={14} />
                <span className="hidden sm:inline">Workflow</span>
              </TabsTrigger>
              <TabsTrigger value="input" className="gap-1.5">
                <Icon name="input" size={14} />
                <span className="hidden sm:inline">Input</span>
              </TabsTrigger>
              <TabsTrigger value="output" className="gap-1.5">
                <Icon name="output" size={14} />
                <span className="hidden sm:inline">Output</span>
              </TabsTrigger>
              <TabsTrigger value="steps" className="gap-1.5">
                <Icon name="list" size={14} />
                <span className="hidden sm:inline">Steps</span>
              </TabsTrigger>
              <TabsTrigger value="logs" className="gap-1.5">
                <Icon name="terminal" size={14} />
                <span className="hidden sm:inline">Logs</span>
                {logs && logs.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 text-xs px-1.5 h-5"
                  >
                    {logs.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden pt-6">
            <TabsContent value="workflow" className="h-full mt-0">
              {workflowUri ? (
                <div className="h-full">
                  <WorkflowDisplayCanvas resourceUri={workflowUri} />
                </div>
              ) : (
                <EmptyState
                  icon="schema"
                  title="No workflow linked"
                  description="This run doesn't have an associated workflow"
                />
              )}
            </TabsContent>
            <TabsContent value="input" className="mt-0">
              <JsonViewer data={input} title="Input" />
            </TabsContent>
            <TabsContent value="output" className="mt-0">
              <JsonViewer data={output} title="Output" />
            </TabsContent>
            <TabsContent value="steps" className="mt-0">
              {stepResults && Object.keys(stepResults).length > 0 ? (
                <ScrollArea className="h-[calc(100vh-28rem)] pr-4">
                  <div className="space-y-4">
                    {Object.entries(stepResults).map(([stepName, result]) => (
                      <Card key={stepName}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-2">
                            <Icon
                              name="check_circle"
                              size={16}
                              className="text-success"
                            />
                            <span className="font-mono text-sm font-semibold">
                              {stepName}
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <ScrollArea className="h-40">
                            <pre className="text-xs font-mono bg-muted/30 p-4 rounded-md">
                              {JSON.stringify(result, null, 2)}
                            </pre>
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-sm text-muted-foreground italic p-4">
                  No step results available
                </div>
              )}
            </TabsContent>
            <TabsContent value="logs" className="mt-0">
              {logs && logs.length > 0 ? (
                <ScrollArea className="h-[calc(100vh-28rem)] pr-4">
                  <div className="space-y-2">
                    {logs.map((log, idx) => (
                      <div
                        key={idx}
                        className={`flex items-start gap-3 p-3 rounded-md text-xs font-mono ${
                          log.type === "error"
                            ? "bg-destructive/10 text-destructive"
                            : log.type === "warn"
                              ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
                              : "bg-muted/50"
                        }`}
                      >
                        <Icon
                          name={
                            log.type === "error"
                              ? "error"
                              : log.type === "warn"
                                ? "warning"
                                : "info"
                          }
                          size={14}
                          className="mt-0.5 flex-shrink-0"
                        />
                        <span className="flex-1 whitespace-pre-wrap break-words">
                          {log.content}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-sm text-muted-foreground italic p-4">
                  No logs available
                </div>
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}

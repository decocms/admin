import { callTool, type WorkflowRunData } from "@deco/sdk";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent, CardHeader } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { EmptyState } from "../common/empty-state.tsx";
import { useResourceRoute } from "../resources-v2/route-context.tsx";
import { getStatusBadgeVariant } from "./utils.ts";

interface WorkflowRunDetailProps {
  resourceUri: string;
}

function getStatusIcon(status: string) {
  if (status === "success" || status === "completed") {
    return <Icon name="check_circle" size={16} className="text-success" />;
  }
  if (status === "failed" || status === "error" || status === "errored") {
    return <Icon name="error" size={16} className="text-destructive" />;
  }
  if (status === "running") {
    return <Icon name="sync" size={16} className="text-primary animate-spin" />;
  }
  return <Icon name="schedule" size={16} className="text-muted-foreground" />;
}

function JsonViewer({ data, title }: { data: unknown; title: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      globalThis.window.alert("Clipboard API unavailable");
      return;
    }

    const payload = JSON.stringify(data, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (error) {
      console.error("Failed to copy workflow run data", error);
    }
  }

  if (data === null || data === undefined) {
    return (
      <div className="text-xs text-muted-foreground italic p-2">
        No {title.toLowerCase()}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {title}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCopy}
          className="h-6 text-xs px-2"
        >
          <Icon
            name={copied ? "check" : "content_copy"}
            size={12}
            className="mr-1"
          />
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <ScrollArea className="max-h-48 rounded border bg-muted/30">
        <pre className="p-3 text-xs font-mono">
          {JSON.stringify(data, null, 2)}
        </pre>
      </ScrollArea>
    </div>
  );
}

function StepError({ error }: { error: unknown }) {
  if (!error) return null;

  const errorObj = error as { name?: string; message?: string };

  return (
    <div className="text-xs bg-destructive/10 text-destructive rounded p-2">
      <div className="font-semibold">{String(errorObj.name || "Error")}</div>
      <div className="mt-1">
        {String(errorObj.message || "An error occurred")}
      </div>
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
        data: WorkflowRunData;
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

  const startedBy = run.data.workflowStatus?.params?.context?.startedBy;
  const steps = run.data.workflowStatus?.steps || [];

  return (
    <ScrollArea className="h-full w-full">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header with status and metadata */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Title and Status */}
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">{headerTitle}</h1>
                <div className="flex items-center gap-2">
                  {statusIcon}
                  <Badge variant={badgeVariant} className="capitalize">
                    {status}
                  </Badge>
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground mb-1">Started</div>
                  <div className="font-mono">
                    {run.data.startTime
                      ? new Date(run.data.startTime).toLocaleString()
                      : "-"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Duration</div>
                  <div className="font-mono">{duration || "-"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Created By</div>
                  <div className="font-mono">
                    {startedBy?.email ||
                      startedBy?.name ||
                      startedBy?.id ||
                      "-"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Workflow</div>
                  <div
                    className="font-mono truncate"
                    title={workflowQuery.data?.data?.name || workflowUri}
                  >
                    {workflowQuery.data?.data?.name ||
                      workflowUri?.split("/").pop() ||
                      "-"}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Alert */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Icon
                  name="error"
                  size={18}
                  className="text-destructive mt-0.5"
                />
                <div className="flex-1">
                  <div className="font-semibold text-destructive mb-2">
                    Error
                  </div>
                  <div className="text-sm text-destructive whitespace-pre-wrap bg-destructive/5 rounded p-3">
                    {error}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Input / Output */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Input & Output</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <JsonViewer data={input} title="Input" />
            {status === "completed" || status === "success" ? (
              <JsonViewer data={output} title="Output" />
            ) : (
              <div className="pt-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Output
                </span>
                <div className="text-xs text-muted-foreground italic p-2 mt-2">
                  Output will be available when the workflow completes
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Steps */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Steps</h2>
          </CardHeader>
          <CardContent>
            {steps.length > 0 ? (
              <div className="space-y-3">
                {steps.map((step, idx) => {
                  const stepStatus =
                    step.success === true
                      ? "completed"
                      : step.success === false
                        ? "failed"
                        : step.start && !step.end
                          ? "running"
                          : "pending";

                  return (
                    <Card
                      key={idx}
                      className="border-l-4"
                      style={{
                        borderLeftColor:
                          stepStatus === "completed"
                            ? "hsl(var(--success))"
                            : stepStatus === "failed"
                              ? "hsl(var(--destructive))"
                              : stepStatus === "running"
                                ? "hsl(var(--primary))"
                                : "hsl(var(--muted))",
                      }}
                    >
                      <CardContent className="pt-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(stepStatus)}
                            <span className="font-mono font-semibold">
                              {String(step.name || `Step ${idx + 1}`)}
                            </span>
                            <Badge
                              variant={getStatusBadgeVariant(stepStatus)}
                              className="capitalize text-xs"
                            >
                              {stepStatus}
                            </Badge>
                          </div>
                          {step.type && (
                            <Badge variant="outline" className="text-xs">
                              {String(step.type)}
                            </Badge>
                          )}
                        </div>

                        <StepError error={step.error} />

                        {step.config !== undefined && step.config !== null && (
                          <JsonViewer data={step.config} title="Config" />
                        )}

                        {step.output !== undefined && step.output !== null && (
                          <JsonViewer data={step.output} title="Output" />
                        )}

                        {step.start || step.end ? (
                          <div className="flex gap-4 text-xs text-muted-foreground pt-2">
                            {step.start && (
                              <div>
                                <span className="font-medium">Started:</span>{" "}
                                <span className="font-mono">
                                  {new Date(step.start).toLocaleTimeString()}
                                </span>
                              </div>
                            )}
                            {step.end && (
                              <div>
                                <span className="font-medium">Ended:</span>{" "}
                                <span className="font-mono">
                                  {new Date(step.end).toLocaleTimeString()}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : null}

                        {step.attempts && step.attempts.length > 1 && (
                          <details className="text-xs">
                            <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
                              {step.attempts.length} attempts
                            </summary>
                            <div className="mt-2 space-y-2 pl-4">
                              {step.attempts.map((attempt, attemptIdx) => (
                                <div
                                  key={attemptIdx}
                                  className="border-l-2 pl-2 py-1"
                                >
                                  <div className="flex items-center gap-2">
                                    <span>Attempt {attemptIdx + 1}</span>
                                    {attempt.success ? (
                                      <Icon
                                        name="check_circle"
                                        size={12}
                                        className="text-success"
                                      />
                                    ) : (
                                      <Icon
                                        name="error"
                                        size={12}
                                        className="text-destructive"
                                      />
                                    )}
                                  </div>
                                  {attempt.error && (
                                    <div className="text-destructive mt-1">
                                      {String(
                                        (attempt.error as { message?: string })
                                          .message || "Error",
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground italic py-4">
                No steps available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}

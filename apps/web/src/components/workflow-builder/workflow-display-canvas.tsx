import {
  callTool,
  useRecentResources,
  useSDK,
  useWorkflowByUriV2,
  type WorkflowDefinition,
  type WorkflowRunData,
  type WorkflowStep,
} from "@deco/sdk";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@deco/ui/components/alert.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import Form from "@rjsf/shadcn";
import validator from "@rjsf/validator-ajv8";
import { useQuery } from "@tanstack/react-query";
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { EmptyState } from "../common/empty-state.tsx";
import { UserInfo } from "../common/table/table-cells.tsx";
import { useDecopilotOpen } from "../layout/decopilot-layout.tsx";
import { useResourceRoute } from "../resources-v2/route-context.tsx";
import { getStatusBadgeVariant } from "../workflows/utils.ts";
import { WorkflowStepCard } from "../workflows/workflow-step-card.tsx";

const LazyHighlighter = lazy(() => import("../chat/lazy-highlighter.tsx"));

interface WorkflowDisplayCanvasProps {
  resourceUri: string;
  onRefresh?: () => Promise<void>;
}

interface JsonViewerProps {
  data: unknown;
  title: string;
  matchHeight?: boolean;
}

// Runtime step from workflowStatus.steps (Cloudflare workflow instance)
interface RuntimeStep {
  name?: string;
  type?: string;
  start?: string | null;
  end?: string | null;
  success?: boolean | null;
  output?: unknown;
  error?: { name?: string; message?: string } | null;
  attempts?: Array<{
    start?: string | null;
    end?: string | null;
    success?: boolean | null;
    error?: { name?: string; message?: string } | null;
  }>;
  config?: unknown;
}

// Merged step combines definition with runtime data
type MergedStep = Partial<WorkflowStep> &
  RuntimeStep & {
    def?: WorkflowStep["def"];
  };

function JsonViewer({ data, title, matchHeight = false }: JsonViewerProps) {
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
      console.error("Failed to copy data", error);
    }
  }

  if (data === null || data === undefined) {
    return (
      <div className="space-y-2">
        <p className="font-mono text-sm text-muted-foreground uppercase">
          {title}
        </p>
        <div className="text-xs text-muted-foreground italic p-2">
          No {title.toLowerCase()}
        </div>
      </div>
    );
  }

  const jsonString = JSON.stringify(data, null, 2);

  return (
    <div
      className={`space-y-2 min-w-0 w-full ${matchHeight ? "h-full flex flex-col" : ""}`}
    >
      <p className="font-mono text-sm text-muted-foreground uppercase">
        {title}
      </p>
      <div
        className={`relative bg-muted rounded-xl ${matchHeight ? "min-h-[200px]" : ""} max-h-[300px] overflow-auto w-full ${matchHeight ? "flex-1" : ""}`}
      >
        <div className="absolute right-2 top-2 z-10 flex items-center gap-1 bg-background rounded-xl shadow-sm">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleCopy}
            className="h-8 w-8"
          >
            <Icon name={copied ? "check" : "content_copy"} size={16} />
          </Button>
        </div>
        <div
          className={`overflow-x-auto w-full ${matchHeight ? "h-full" : ""}`}
        >
          <Suspense
            fallback={
              <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all">
                {jsonString}
              </pre>
            }
          >
            <LazyHighlighter
              language="json"
              content={jsonString}
              fillHeight={matchHeight}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

/**
 * Interactive workflow canvas that shows a form for workflow input
 * and displays the run results below
 */
export function WorkflowDisplayCanvas({
  resourceUri,
  onRefresh: _onRefresh,
}: WorkflowDisplayCanvasProps) {
  const { connection } = useResourceRoute();
  const { data: resource, isLoading: isLoadingWorkflow } =
    useWorkflowByUriV2(resourceUri);
  const workflow = resource?.data;

  // Track recent workflows (Resources v2 workflow detail)
  const { locator } = useSDK();
  const projectKey = typeof locator === "string" ? locator : undefined;
  const { addRecent } = useRecentResources(projectKey);
  const hasTrackedRecentRef = useRef(false);
  const { toggle: toggleChat } = useDecopilotOpen();

  useEffect(() => {
    if (workflow && resourceUri && projectKey && !hasTrackedRecentRef.current) {
      hasTrackedRecentRef.current = true;
      setTimeout(() => {
        addRecent({
          id: resourceUri,
          name: workflow.name || resourceUri,
          type: "workflow",
          icon: "flowchart",
          path: `/${projectKey}/rsc/i:workflows-management/workflow/${encodeURIComponent(resourceUri)}`,
        });
      }, 0);
    }
  }, [workflow, resourceUri, projectKey, addRecent]);

  // Form state for workflow input
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [currentRunUri, setCurrentRunUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch run data if we have a run URI
  const runQuery = useQuery({
    queryKey: ["workflow-run-read", currentRunUri],
    enabled: Boolean(connection && currentRunUri),
    queryFn: async () => {
      const result = await callTool(connection!, {
        name: "DECO_RESOURCE_WORKFLOW_RUN_READ",
        arguments: { uri: currentRunUri! },
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

  const run = runQuery.data;

  // Handle form submission - start workflow
  async function handleFormSubmit(data: Record<string, unknown>) {
    if (!connection || !resourceUri) return;

    try {
      setIsSubmitting(true);
      const result = await callTool(connection, {
        name: "DECO_WORKFLOW_START",
        arguments: {
          uri: resourceUri,
          input: data,
        },
      });

      const response = result.structuredContent as {
        runId?: string;
        uri?: string;
        error?: string;
      };

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.uri) {
        setCurrentRunUri(response.uri);
      }
    } catch (error) {
      console.error("Failed to start workflow", error);
      globalThis.window.alert(
        `Failed to start workflow: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // Calculate duration
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

  const input = useMemo(
    () => run?.data?.workflowStatus?.params?.input,
    [run?.data?.workflowStatus],
  );
  const output = useMemo(
    () => run?.data?.finalResult,
    [run?.data?.finalResult],
  );
  const error = run?.data?.error;
  const status = run?.data?.status || "unknown";
  const badgeVariant = getStatusBadgeVariant(status);
  const startedBy = run?.data.workflowStatus?.params?.context?.startedBy;

  // Merge workflow definition steps with runtime steps
  const steps = useMemo<MergedStep[]>(() => {
    const runSteps = run?.data.workflowStatus?.steps;
    const definitionSteps = (workflow as WorkflowDefinition)?.steps;

    // If no definition steps, return empty or just runtime steps
    if (!definitionSteps || !Array.isArray(definitionSteps)) {
      return (runSteps || []) as MergedStep[];
    }

    // If no run yet, show all definition steps
    if (!runSteps || runSteps.length === 0) {
      return definitionSteps as MergedStep[];
    }

    // Merge: for each definition step, use runtime data if available
    return definitionSteps.map((defStep: WorkflowStep, idx: number) => {
      const runtimeStep = runSteps[idx];

      // If we have runtime data for this step, merge it with definition
      if (runtimeStep) {
        return {
          ...defStep,
          ...runtimeStep,
          // Keep definition data in 'def' for reference
          def: defStep.def || defStep,
        } as MergedStep;
      }

      // Otherwise, return the definition step (pending)
      return defStep as MergedStep;
    });
  }, [run?.data.workflowStatus?.steps, workflow]);

  if (isLoadingWorkflow) {
    return (
      <div className="h-[calc(100vh-12rem)] flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!workflow) {
    return (
      <EmptyState
        icon="error"
        title="Workflow not found"
        description="Could not load workflow"
      />
    );
  }

  return (
    <ScrollArea className="h-full w-full">
      <div className="flex flex-col">
        {/* Header */}
        <div className="border-b border-border py-4 px-4 md:py-8 md:px-8 lg:py-16 lg:px-16">
          <div className="max-w-[1500px] mx-auto space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h1 className="text-2xl font-medium">{workflow.name}</h1>
                {workflow.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {workflow.description}
                  </p>
                )}
              </div>
              {run && (
                <Badge variant={badgeVariant} className="capitalize">
                  {status}
                </Badge>
              )}
            </div>

            {/* Run metadata */}
            {run && (
              <div className="flex items-center gap-4 flex-wrap text-sm">
                <div className="flex items-center gap-2">
                  <Icon
                    name="calendar_month"
                    size={16}
                    className="text-muted-foreground"
                  />
                  <span className="font-mono text-sm uppercase">
                    {run.data.startTime
                      ? new Date(run.data.startTime).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "-"}
                  </span>
                </div>

                <div className="h-3 w-px bg-border" />

                <div className="flex items-center gap-2">
                  <Icon
                    name="schedule"
                    size={16}
                    className="text-muted-foreground"
                  />
                  <span className="font-mono text-sm">{duration || "-"}</span>
                </div>

                <div className="h-3 w-px bg-border" />

                {startedBy?.id && (
                  <UserInfo
                    userId={startedBy.id}
                    size="sm"
                    noTooltip
                    showEmail={false}
                  />
                )}
              </div>
            )}

            {/* Error Alert */}
            {error && (
              <Alert className="bg-destructive/5 border-none">
                <Icon name="error" className="h-4 w-4 text-destructive" />
                <AlertTitle className="text-destructive">Error</AlertTitle>
                <AlertDescription className="text-destructive">
                  {error}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        {/* Input Form */}
        <div className="border-b border-border py-4 px-4 md:py-8 md:px-8 lg:py-8 lg:px-16">
          <div className="max-w-[1500px] mx-auto space-y-4">
            <h2 className="text-lg font-medium">Input</h2>

            <div className="bg-muted/30 rounded-xl p-6">
              {workflow.inputSchema &&
              typeof workflow.inputSchema === "object" &&
              "properties" in workflow.inputSchema &&
              workflow.inputSchema.properties &&
              Object.keys(workflow.inputSchema.properties).length > 0 ? (
                <Form
                  schema={workflow.inputSchema}
                  validator={validator}
                  formData={formData}
                  onChange={({ formData }) => setFormData(formData)}
                  onSubmit={({ formData }) => handleFormSubmit(formData)}
                  showErrorList={false}
                  noHtml5Validate
                  liveValidate={false}
                >
                  <div className="flex justify-end gap-2 mt-4">
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      size="lg"
                      className="min-w-[200px] flex items-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <Spinner size="xs" />
                          Running...
                        </>
                      ) : (
                        <>
                          <Icon name="play_arrow" size={18} />
                          Run Workflow
                        </>
                      )}
                    </Button>
                  </div>
                </Form>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="bg-background rounded-full p-4 mb-4">
                    <Icon
                      name="chat"
                      size={32}
                      className="text-muted-foreground"
                    />
                  </div>
                  <h3 className="text-lg font-medium mb-2">No Input Form</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Create and configure workflows in chat.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={toggleChat}
                  >
                    <Icon name="chat" size={16} className="mr-2" />
                    Open Chat
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Output Section - only show if we have a run */}
        {run && (
          <div className="border-b border-border py-4 px-4 md:py-8 md:px-8 lg:py-8 lg:px-16">
            <div className="max-w-[1500px] mx-auto space-y-4">
              <h2 className="text-lg font-medium">Input & Output</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                <div className="min-w-0 flex">
                  <JsonViewer data={input} title="Input" matchHeight />
                </div>

                <div className="min-w-0 flex">
                  {status === "completed" || status === "success" ? (
                    <JsonViewer data={output} title="Output" matchHeight />
                  ) : (
                    <div className="space-y-2 w-full">
                      <p className="font-mono text-sm text-muted-foreground uppercase">
                        Output
                      </p>
                      <div className="bg-muted rounded-xl min-h-[200px] max-h-[300px] flex items-center justify-center p-4">
                        <div className="text-xs text-muted-foreground italic text-center">
                          Output will be available when the workflow completes
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Steps Section - show definition steps before run, runtime steps after */}
        <div className="border-b border-border py-4 px-4 md:py-8 md:px-8 lg:py-8 lg:px-16">
          <div className="max-w-[1500px] mx-auto space-y-4">
            <h2 className="text-lg font-medium">Steps</h2>

            {steps.length > 0 ? (
              <div className="flex flex-col items-center">
                <div className="w-full max-w-[700px] space-y-0">
                  {steps.map((step, idx) => {
                    const stableKey =
                      (step as { id?: string }).id ||
                      step.name ||
                      `step-${idx}`;
                    return (
                      <div key={stableKey}>
                        {idx > 0 && (
                          <div className="h-10 w-full flex justify-center">
                            <div className="w-px bg-border" />
                          </div>
                        )}
                        <Suspense fallback={<Spinner />}>
                          <WorkflowStepCard step={step} index={idx} />
                        </Suspense>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground italic py-4">
                No steps available yet
              </div>
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

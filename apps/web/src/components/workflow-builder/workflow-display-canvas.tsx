import {
  callTool,
  useRecentResources,
  useSDK,
  useStartWorkflow,
  useWorkflowByUriV2,
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
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { EmptyState } from "../common/empty-state.tsx";
import { UserInfo } from "../common/table/table-cells.tsx";
import { useResourceRoute } from "../resources-v2/route-context.tsx";
import { getStatusBadgeVariant } from "../workflows/utils.ts";
import { WorkflowStepCard } from "../workflows/workflow-step-card.tsx";
import {
  useMergedSteps,
  useStepOutputs,
  useWorkflow,
  useWorkflowActions,
  useWorkflowUri,
  useStepInput,
  useStepInputs,
} from "../../stores/workflows/hooks.ts";
import { WorkflowStoreProvider } from "../../stores/workflows/provider.tsx";
import { DetailSection } from "../common/detail-section.tsx";
import {
  useCurrentRunUri,
  useWorkflowRunsStoreActions,
} from "../../stores/workflows/runs/store.ts";
interface WorkflowDisplayCanvasProps {
  resourceUri: string;
  onRefresh?: () => Promise<void>;
}

// Reference resolution utilities
function isAtRef(value: unknown): value is `@${string}` {
  return typeof value === "string" && value.startsWith("@");
}

function parseAtRef(ref: `@${string}`): {
  type: "step" | "input";
  id?: string;
  path?: string;
} {
  const refStr = ref.substring(1); // Remove @ prefix

  // Input reference: @input.path.to.value
  if (refStr.startsWith("input")) {
    const path = refStr.substring(6); // Remove 'input.'
    return { type: "input", path };
  }

  // Step reference: @stepId.path.to.value
  const [id, ...pathParts] = refStr.split(".");

  // If path starts with 'output.', remove it since stepResults already contains the output
  let path = pathParts.join(".");
  if (path.startsWith("output.")) {
    path = path.substring(7); // Remove 'output.'
  }

  return { type: "step", id, path };
}

function getValue(
  obj: Record<string, unknown> | unknown[] | unknown,
  path: string,
): unknown {
  if (!path) return obj;

  const keys = path.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current === "object" && !Array.isArray(current)) {
      current = (current as Record<string, unknown>)[key];
    } else if (Array.isArray(current)) {
      const index = parseInt(key, 10);
      current = isNaN(index) ? undefined : current[index];
    } else {
      return undefined;
    }
  }

  return current;
}

function resolveAtRef(
  ref: `@${string}`,
  stepOutputs: Record<string, unknown>,
  firstStepInput?: unknown,
): { value: unknown; error?: string } {
  try {
    const parsed = parseAtRef(ref);

    switch (parsed.type) {
      case "input": {
        // Resolve @input.* to the first step's input
        const value = getValue(
          (firstStepInput as Record<string, unknown>) || {},
          parsed.path || "",
        );
        if (value === undefined) {
          return { value: null, error: `Input path not found: ${parsed.path}` };
        }
        return { value };
      }

      case "step": {
        const identifier = parsed.id || "";
        const stepResult = stepOutputs[identifier];

        if (stepResult === undefined) {
          return {
            value: null,
            error: `Step not found or not executed: ${identifier}`,
          };
        }
        const value = getValue(stepResult, parsed.path || "");
        if (value === undefined) {
          return {
            value: null,
            error: `Path not found in step result: ${parsed.path}`,
          };
        }
        return { value };
      }

      default:
        return { value: null, error: `Unknown reference type: ${ref}` };
    }
  } catch (error) {
    return { value: null, error: `Failed to resolve ${ref}: ${String(error)}` };
  }
}

function resolveAtRefsInInput(
  input: unknown,
  stepOutputs: Record<string, unknown>,
  firstStepInput?: unknown,
): { resolved: unknown; errors?: Array<{ ref: string; error: string }> } {
  const errors: Array<{ ref: string; error: string }> = [];

  function resolveValue(value: unknown): unknown {
    // If it's an @ref, resolve it
    if (isAtRef(value)) {
      const result = resolveAtRef(value, stepOutputs, firstStepInput);
      if (result.error) {
        errors.push({ ref: value, error: result.error });
      }
      return result.value;
    }

    // If it's an array, resolve each element
    if (Array.isArray(value)) {
      return value.map((v) => resolveValue(v));
    }

    // If it's an object, resolve each property
    if (value !== null && typeof value === "object") {
      const resolvedObj: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        resolvedObj[key] = resolveValue(val);
      }
      return resolvedObj;
    }

    // Primitive value, return as-is
    return value;
  }

  const resolved = resolveValue(input);
  return { resolved, errors: errors.length > 0 ? errors : undefined };
}

interface RuntimeStep {
  name?: string;
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

export type MergedStep = Partial<WorkflowStep> &
  RuntimeStep & {
    def?: WorkflowStep["def"];
  };

export function WorkflowDisplay({ resourceUri }: WorkflowDisplayCanvasProps) {
  const { data: resource, isLoading: isLoadingWorkflow } =
    useWorkflowByUriV2(resourceUri);
  const workflow = resource?.data;
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
    <WorkflowStoreProvider workflow={workflow}>
      <Canvas />
    </WorkflowStoreProvider>
  );
}

export function useWorkflowRunQuery() {
  const { connection } = useResourceRoute();
  const currentRunUri = useCurrentRunUri();
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
  return runQuery;
}

function StartWorkflowButton() {
  const { mutateAsync } = useStartWorkflow();
  const workflow = useWorkflow();
  const workflowUri = useWorkflowUri();
  const initialInput = useStepInput(workflow.steps[0].def.name);
  const { setCurrentRunUri } = useWorkflowRunsStoreActions();
  const handleStartWorkflow = async () => {
    await mutateAsync(
      {
        uri: workflowUri,
        input: initialInput as Record<string, unknown>,
      },
      {
        onSuccess: (data) => {
          console.log(data);
          if (data.uri) setCurrentRunUri(data.uri);
        },
      },
    );
  };
  return (
    <Button variant="special" onClick={handleStartWorkflow}>
      <Icon name="play_arrow" size={18} />
      Start Workflow
    </Button>
  );
}

function ClearWorkflowButton() {
  const currentRunUri = useCurrentRunUri();
  const { setCurrentRunUri } = useWorkflowRunsStoreActions();
  const handleClearWorkflow = () => {
    setCurrentRunUri(null);
  };
  return (
    <Button
      disabled={!currentRunUri}
      size="icon"
      variant="ghost"
      onClick={handleClearWorkflow}
    >
      <Icon name="refresh" size={18} />
    </Button>
  );
}

/**
 * Interactive workflow canvas that shows a form for workflow input
 * and displays the run results below
 */
export function Canvas() {
  const workflow = useWorkflow();
  const resourceUri = useWorkflowUri();

  // Track recent workflows (Resources v2 workflow detail)
  const { locator } = useSDK();
  const projectKey = typeof locator === "string" ? locator : undefined;
  const { addRecent } = useRecentResources(projectKey);
  const hasTrackedRecentRef = useRef(false);
  const runQuery = useWorkflowRunQuery();

  useEffect(() => {
    if (workflow && resourceUri && projectKey && !hasTrackedRecentRef.current) {
      hasTrackedRecentRef.current = true;
      setTimeout(() => {
        addRecent({
          id: resourceUri,
          name: workflow.name || resourceUri,
          type: "workflow",
          icon: "flowchart",
          path: `/${projectKey}/rsc/i:workflows-management/workflow/${encodeURIComponent(
            resourceUri,
          )}`,
        });
      }, 0);
    }
  }, [workflow, resourceUri, projectKey, addRecent]);

  // Fetch run data if we have a run URI

  const run = runQuery.data;

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

  const error = run?.data?.error;
  const status = run?.data?.status || "unknown";
  const badgeVariant = getStatusBadgeVariant(status);
  const startedBy = run?.data.workflowStatus?.params?.context?.startedBy;

  // Merge workflow definition steps with runtime steps

  return (
    <ScrollArea className="h-full w-full">
      <div className="flex flex-col">
        {/* Header */}
        <DetailSection>
          <div className="flex items-center justify-between">
            <div>
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
            <div className="flex items-center gap-2">
              <StartWorkflowButton />
              <ClearWorkflowButton />
            </div>
          </div>
        </DetailSection>

        {/* Steps Section - show definition steps before run, runtime steps after */}
        <DetailSection title="Steps">
          <WorkflowStepsList />
        </DetailSection>
      </div>
    </ScrollArea>
  );
}

function WorkflowStepsList() {
  const steps = useMergedSteps();

  if (!steps || steps.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic py-4">
        No steps available yet
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center">
      <div className="w-full max-w-[700px] space-y-8">
        {steps.map((step, idx) => {
          return (
            <div key={idx}>
              <Suspense fallback={<Spinner />}>
                <WorkflowStepCard
                  stepName={step.name || step.def?.name || `Step ${idx + 1}`}
                />
              </Suspense>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StepInput({ step }: { step: MergedStep }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { connection } = useResourceRoute();
  const { setStepOutput, setStepInput } = useWorkflowActions();
  const workflowUri = useWorkflowUri();
  const { locator } = useSDK();
  const stepOutputs = useStepOutputs();
  const mergedSteps = useMergedSteps();
  const stepName = step.name || step.def?.name || "";
  const persistedInput = useStepInput(stepName);
  const stepInputs = useStepInputs();

  async function handleFormSubmit(data: Record<string, unknown>) {
    if (!connection || !workflowUri) return;

    try {
      setIsSubmitting(true);

      // Get the first step's input to resolve @input.* references
      // Use persisted input if available, otherwise fall back to the prop value
      const firstStep = mergedSteps?.[0];
      const firstStepName = firstStep?.name || firstStep?.def?.name;
      const firstStepInput = firstStepName
        ? (stepInputs[firstStepName] ?? firstStep?.input)
        : firstStep?.input;

      // Resolve any @ references in the input data
      const { resolved, errors } = resolveAtRefsInInput(
        data,
        stepOutputs,
        firstStepInput,
      );

      // Show errors if any references couldn't be resolved
      if (errors && errors.length > 0) {
        const errorMessages = errors
          .map((e) => `${e.ref}: ${e.error}`)
          .join("\n");
        throw new Error(`Failed to resolve references:\n${errorMessages}`);
      }

      const result = await callTool(
        connection,
        {
          name: "DECO_WORKFLOW_RUN_STEP",
          arguments: {
            tool: step.def,
            input: resolved,
          },
        },
        locator,
      );

      // Handle nested structuredContent (MCP response wrapping)
      const mcpResponse = result.structuredContent as {
        structuredContent?: {
          result?: {
            result?: unknown;
            [key: string]: unknown;
          };
          error?: string;
        };
        result?: unknown;
        error?: string;
      };

      // Try to unwrap nested structuredContent first
      const response = mcpResponse.structuredContent || mcpResponse;

      if (response.error) {
        throw new Error(response.error);
      }

      // Extract the actual tool output from nested result structure
      let stepOutput: unknown;
      if (typeof response.result === "object" && response.result !== null) {
        const resultObj = response.result as { result?: unknown };
        // Check if there's a nested result.result structure
        if (typeof resultObj.result === "object" && resultObj.result !== null) {
          const nestedResult = resultObj.result as { result?: unknown };
          // Store the deepest result we can find
          stepOutput =
            nestedResult.result !== undefined
              ? nestedResult.result
              : resultObj.result;
        } else {
          // Store result.result if it exists, otherwise store result
          stepOutput =
            resultObj.result !== undefined ? resultObj.result : response.result;
        }
      } else {
        stepOutput = response.result;
      }

      if (stepOutput !== undefined) {
        if (!step.name && !step.def?.name) return;
        setStepOutput(step.name || step.def?.name!, stepOutput);
      }
    } catch (error) {
      console.error("Failed to run step", error);
      globalThis.window.alert(
        `Failed to run step: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const stepInputSchema = useMemo(() => {
    return step.def?.inputSchema;
  }, [step]);

  // Use persisted input if available, otherwise fall back to step.input
  const formData = useMemo(() => {
    return persistedInput !== undefined ? persistedInput : step.input;
  }, [persistedInput, step.input]);

  function handleFormChange(data: { formData?: unknown }) {
    // Persist input changes to the store
    if (data.formData !== undefined) {
      setStepInput(stepName, data.formData);
    }
  }

  return (
    <div className="bg-muted/30 rounded-xl p-6">
      {stepInputSchema &&
      typeof stepInputSchema === "object" &&
      "properties" in stepInputSchema &&
      stepInputSchema.properties &&
      Object.keys(stepInputSchema.properties).length > 0 ? (
        <Form
          schema={stepInputSchema}
          validator={validator}
          formData={formData}
          onChange={handleFormChange}
          onSubmit={(data) => handleFormSubmit(data.formData || {})}
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
                  Run Step
                </>
              )}
            </Button>
          </div>
        </Form>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center gap-4">
          <p className="text-sm text-muted-foreground">
            This Step does not require any input parameters.
          </p>
          <Button
            disabled={isSubmitting}
            size="lg"
            onClick={() => handleFormSubmit({})}
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
                Run Step
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

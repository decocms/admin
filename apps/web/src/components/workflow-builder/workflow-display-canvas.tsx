import {
  callTool,
  useRecentResources,
  useSDK,
  useStartWorkflow,
  useWorkflowByUriV2,
  type WorkflowRunData,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useQuery } from "@tanstack/react-query";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { EmptyState } from "../common/empty-state.tsx";
import { useResourceRoute } from "../resources-v2/route-context.tsx";
import { WorkflowStepCard } from "../workflows/workflow-step-card.tsx";
import {
  useWorkflowActions,
  useWorkflowDescription,
  useWorkflowFirstStepInput,
  useWorkflowName,
  useWorkflowStepDefinition,
  useWorkflowStepInput,
  useWorkflowStepNames,
  useWorkflowStepOutputs,
  useWorkflowUri,
} from "../../stores/workflows/hooks.ts";
import { WorkflowStoreProvider } from "../../stores/workflows/provider.tsx";
import { DetailSection } from "../common/detail-section.tsx";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { toast } from "@deco/ui/components/sonner.tsx";
import { useForm } from "react-hook-form";
import { Form } from "@deco/ui/components/form.tsx";
import type { JSONSchema7 } from "json-schema";
import {
  WorkflowStepField,
  NestedObjectField,
} from "./workflow-step-field.tsx";
import { useWorkflowAvailableRefs } from "../../hooks/use-workflow-available-refs.ts";
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

// Reference resolution utilities moved to use-workflow-available-refs.ts hook

/**
 * Unwraps the nested MCP response structure to extract the actual tool output.
 *
 * MCP responses can have inconsistent nesting levels:
 * - { result: value }
 * - { result: { result: value } }
 * - { structuredContent: { result: value } }
 * - { structuredContent: { result: { result: value } } }
 *
 * This utility recursively unwraps these structures to find the deepest result value.
 *
 * @param response - The MCP response object from callTool
 * @returns The unwrapped tool output value
 * @throws Error if the response contains an error field
 */
function unwrapMCPResponse(response: unknown): unknown {
  if (!response || typeof response !== "object") {
    return response;
  }

  const resp = response as {
    structuredContent?: unknown;
    result?: unknown;
    error?: string;
    [key: string]: unknown;
  };

  // Check for error first
  if (resp.error) {
    throw new Error(resp.error);
  }

  // Try to unwrap nested structuredContent first
  if (resp.structuredContent) {
    return unwrapMCPResponse(resp.structuredContent);
  }

  // If there's a result field, check if it has nested results
  if ("result" in resp) {
    const result = resp.result;

    // If result is an object with its own result field, unwrap it
    if (result && typeof result === "object" && "result" in result) {
      return unwrapMCPResponse(result);
    }

    // Otherwise return the result as-is
    return result;
  }

  // No result or structuredContent found, return the original response
  return response;
}

export function WorkflowDisplay({ resourceUri }: WorkflowDisplayCanvasProps) {
  const { data: resource, isLoading: isLoadingWorkflow } =
    useWorkflowByUriV2(resourceUri);
  const workflow = resource?.data;

  // Only show loading on initial load, not on refetch
  if (isLoadingWorkflow && !workflow) {
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
    <WorkflowStoreProvider key={workflow.name} workflow={workflow}>
      <Canvas />
    </WorkflowStoreProvider>
  );
}

export function useWorkflowRunQuery(enabled: boolean = false) {
  const { connection, resourceUri } = useResourceRoute();
  const runUri = resourceUri;

  const runQuery = useQuery({
    queryKey: ["workflow-run-read", runUri],
    enabled: Boolean(connection && runUri && enabled),
    queryFn: async () => {
      if (!connection || !runUri) {
        throw new Error("Connection and runUri are required");
      }

      const result = await callTool(connection, {
        name: "DECO_RESOURCE_WORKFLOW_RUN_READ",
        arguments: { uri: runUri },
      });

      const data = result.structuredContent as
        | {
            uri: string;
            data: WorkflowRunData;
            created_at?: string;
            updated_at?: string;
          }
        | undefined;

      if (!data) {
        throw new Error("No data returned from workflow run query");
      }

      return data;
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

const StartWorkflowButton = () => {
  const { mutateAsync, isPending } = useStartWorkflow();
  const workflowUri = useWorkflowUri();
  const navigateWorkspace = useNavigateWorkspace();
  const firstStepInput = useWorkflowFirstStepInput();

  const handleStartWorkflow = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      // Prevent any default behavior that might cause page reload
      e.preventDefault();
      e.stopPropagation();

      try {
        await mutateAsync(
          {
            uri: workflowUri,
            input: firstStepInput as Record<string, unknown>,
          },
          {
            onSuccess: (data) => {
              if (!data.uri) return;
              navigateWorkspace(
                `/rsc/i:workflows-management/workflow_run/${encodeURIComponent(data.uri)}`,
              );
            },
          },
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to start workflow",
        );
      }
    },
    [mutateAsync, workflowUri, firstStepInput, navigateWorkspace],
  );

  return (
    <Button
      type="button"
      disabled={isPending}
      variant="special"
      onClick={handleStartWorkflow}
      className="min-w-[200px] flex items-center gap-2"
    >
      {isPending ? (
        <>
          <Spinner size="xs" /> Starting...
        </>
      ) : (
        <>
          <Icon name="play_arrow" size={18} /> Start Workflow
        </>
      )}
    </Button>
  );
};

/**
 * Interactive workflow canvas that shows a form for workflow input
 * and displays the run results below
 */
export function Canvas() {
  const resourceUri = useWorkflowUri();
  const workflowName = useWorkflowName();
  const workflowDescription = useWorkflowDescription();
  // Track recent workflows (Resources v2 workflow detail)
  const { locator } = useSDK();
  const projectKey = typeof locator === "string" ? locator : undefined;
  const { addRecent } = useRecentResources(projectKey);
  const hasTrackedRecentRef = useRef(false);

  useEffect(() => {
    if (
      workflowName &&
      resourceUri &&
      projectKey &&
      !hasTrackedRecentRef.current
    ) {
      hasTrackedRecentRef.current = true;
      setTimeout(() => {
        addRecent({
          id: resourceUri,
          name: workflowName,
          type: "workflow",
          icon: "flowchart",
          path: `/${projectKey}/rsc/i:workflows-management/workflow/${encodeURIComponent(
            resourceUri,
          )}`,
        });
      }, 0);
    }
  }, [workflowName, resourceUri, projectKey, addRecent]);

  return (
    <ScrollArea className="h-full w-full">
      <div className="flex flex-col">
        {/* Header */}
        <DetailSection>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h1 className="text-2xl font-medium">{workflowName}</h1>
                  {workflowDescription && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {workflowDescription}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StartWorkflowButton />
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
  const stepNames = useWorkflowStepNames();
  if (!stepNames || stepNames.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic py-4">
        No steps available yet
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center">
      <div className="w-full max-w-[700px] space-y-8">
        {stepNames.map((stepName, index) => {
          return (
            <div key={`${stepName}-${index}`}>
              <Suspense fallback={<Spinner />}>
                <WorkflowStepCard stepName={stepName} type="definition" />
              </Suspense>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StepInput({ stepName }: { stepName: string }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { connection } = useResourceRoute();
  const { setStepOutput, setStepExecutionStart, setStepExecutionEnd } =
    useWorkflowActions();
  const workflowUri = useWorkflowUri();
  const { locator } = useSDK();
  const stepOutputs = useWorkflowStepOutputs();
  const stepInput = useWorkflowStepInput(stepName);
  const stepDefinition = useWorkflowStepDefinition(stepName);
  const firstStepInput = useWorkflowFirstStepInput();

  const stepInputSchema = useMemo(() => {
    return stepDefinition?.inputSchema as JSONSchema7 | undefined;
  }, [stepDefinition]);

  // Use optimized hook for available refs
  const availableRefs = useWorkflowAvailableRefs(stepName);

  // Initialize form with current step input
  const form = useForm<Record<string, unknown>>({
    defaultValues: stepInput || {},
    mode: "onSubmit",
  });

  const handleFormSubmit = useCallback(
    async (data: Record<string, unknown>) => {
      if (!connection || !workflowUri) return;

      try {
        setIsSubmitting(true);
        setStepExecutionStart(stepName);

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
              tool: stepDefinition,
              input: resolved,
            },
          },
          locator,
        );

        // Unwrap the MCP response to extract the actual step output
        const stepOutput = unwrapMCPResponse(result.structuredContent);

        if (stepOutput !== undefined) {
          if (!stepDefinition?.name) return;
          setStepOutput(stepDefinition.name, stepOutput);
        }

        // Record successful execution
        setStepExecutionEnd(stepName, true);
        toast.success("Step executed successfully!");
      } catch (error) {
        console.error("Failed to run step", error);

        // Record failed execution
        const errorObj =
          error instanceof Error
            ? { name: error.name, message: error.message }
            : { name: "Error", message: String(error) };
        setStepExecutionEnd(stepName, false, errorObj);

        toast.error(
          error instanceof Error ? error.message : "Failed to run step",
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      connection,
      workflowUri,
      stepName,
      stepOutputs,
      firstStepInput,
      stepDefinition,
      locator,
      setStepExecutionStart,
      setStepExecutionEnd,
      setStepOutput,
    ],
  );

  // Check if schema has properties
  const hasProperties =
    stepInputSchema &&
    typeof stepInputSchema === "object" &&
    "properties" in stepInputSchema &&
    stepInputSchema.properties &&
    Object.keys(stepInputSchema.properties).length > 0;

  if (!hasProperties) {
    return (
      <div className="bg-gradient-to-br from-muted/30 to-muted/10 rounded-xl p-8 border border-dashed">
        <div className="flex flex-col items-center justify-center text-center gap-4">
          <div className="rounded-full bg-primary/10 p-4">
            <Icon name="check_circle" size={32} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium mb-1">Ready to Execute</p>
            <p className="text-xs text-muted-foreground">
              This step does not require any input parameters
            </p>
          </div>
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
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-muted/30 to-muted/10 rounded-xl p-6 border">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((data) =>
            handleFormSubmit(data as Record<string, unknown>),
          )}
          className="space-y-6"
        >
          {Object.entries(stepInputSchema.properties!).map(
            ([propName, propSchema]) => {
              const isRequired =
                stepInputSchema.required?.includes(propName) ?? false;
              const schema = propSchema as JSONSchema7;

              // Handle nested objects specially
              if (schema.type === "object" && schema.properties) {
                return (
                  <NestedObjectField
                    key={propName}
                    name={propName}
                    schema={schema}
                    form={form}
                    disabled={isSubmitting}
                    availableRefs={availableRefs}
                  />
                );
              }

              return (
                <WorkflowStepField
                  key={propName}
                  name={propName}
                  schema={schema}
                  form={form}
                  isRequired={isRequired}
                  disabled={isSubmitting}
                  availableRefs={availableRefs}
                />
              );
            },
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
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
        </form>
      </Form>
    </div>
  );
}

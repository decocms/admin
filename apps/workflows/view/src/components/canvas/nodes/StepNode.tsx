import { type NodeProps, useStore, Handle, Position } from "reactflow";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { useExecuteStep } from "../../../hooks/useExecuteStep";
import { useState, memo, useMemo, useCallback, useRef, useEffect } from "react";
import { RichTextEditor } from "../../RichTextEditor";
import { RenderInputViewModal } from "../../RenderInputViewModal";
import { useCurrentWorkflow, useWorkflowStoreActions } from "@/store/workflow";
import { StepOutput } from "./step-output";
import type { WorkflowStep, WorkflowDependency } from "shared/types/workflows";

interface StepNodeData {
  stepId: string;
}

// Type guards
function hasErrorOutput(output: unknown): output is { error: string } {
  return (
    typeof output === "object" &&
    output !== null &&
    "error" in output &&
    typeof (output as { error: unknown }).error === "string"
  );
}

function hasSuccessOutput(output: unknown): output is Record<string, unknown> {
  return (
    typeof output === "object" &&
    output !== null &&
    Object.keys(output).length > 0 &&
    !hasErrorOutput(output) // Use the error check to ensure no error exists
  );
}

function hasExecutionResult(output: unknown): output is {
  success: boolean;
  output?: unknown;
  duration?: number;
} {
  return (
    typeof output === "object" &&
    output !== null &&
    "success" in output &&
    typeof (output as { success: unknown }).success === "boolean" &&
    (output as { success: boolean }).success === true &&
    !hasErrorOutput(output) // Only consider it a successful result if no error exists
  );
}

// Components
interface StepErrorProps {
  error: string;
}

function StepError({ error }: StepErrorProps) {
  return (
    <div className="mt-3 p-3 bg-red-950/30 border border-red-900/50 rounded-lg">
      <p className="text-xs text-red-400 font-mono whitespace-pre-wrap">
        {error}
      </p>
    </div>
  );
}

function StepSuccessIndicator() {
  return (
    <div className="flex items-center gap-2 text-sm text-green-500 font-medium">
      <Icon name="check_circle" size={20} />
      <span>Executed successfully</span>
    </div>
  );
}

function StepErrorIndicator() {
  return (
    <div className="flex items-center gap-2 text-sm text-red-500 font-medium">
      <Icon name="error" size={20} />
      <span>Execution failed</span>
    </div>
  );
}

interface JsonViewProps {
  jsonString: string;
  lines: string[];
}

function JsonView({ jsonString, lines }: JsonViewProps) {
  return (
    <div className="bg-background p-4">
      <div
        className="border border-border rounded bg-muted/30"
        style={{
          maxHeight: "500px",
          minHeight: "120px",
          overflowY: "auto",
          overflowX: "hidden",
          cursor: "text",
          pointerEvents: "auto",
        }}
        onWheel={(e) => {
          e.stopPropagation();
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex gap-5 p-4">
          {/* Line numbers */}
          <div className="flex flex-col font-mono text-xs text-muted-foreground leading-[1.5] opacity-50 select-none shrink-0">
            {lines.map((_, i) => (
              <span key={i + 1}>{i + 1}</span>
            ))}
          </div>

          {/* Code content */}
          <div className="flex-1 min-w-0">
            <pre className="font-mono text-xs text-foreground leading-[1.5] m-0 whitespace-pre-wrap break-words">
              {jsonString}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StepFormViewProps {
  step: WorkflowStep;
  inputSchemaEntries: Array<[string, unknown]>;
  workflowActions: ReturnType<typeof useWorkflowStoreActions>;
  onCreateInputView: (key: string) => void;
}

// OPTIMIZED: Memoize to prevent re-renders when parent updates
const StepFormView = memo(function StepFormView({
  step,
  inputSchemaEntries,
  workflowActions,
  onCreateInputView,
}: StepFormViewProps) {
  // Use hook directly instead of prop drilling
  const workflow = useCurrentWorkflow();
  return (
    <>
      {/* Tools Used Section */}
      {step.dependencies && step.dependencies.length > 0 && (
        <div className="bg-background border-b border-border p-4">
          <p className="font-mono text-sm text-muted-foreground uppercase mb-4">
            TOOLS USED
          </p>
          <div className="flex gap-3 flex-wrap">
            {step.dependencies.map((tool: WorkflowDependency) => (
              <Badge
                key={tool.integrationId}
                variant="secondary"
                className="bg-muted border border-border px-1 py-0.5 text-foreground text-sm font-normal gap-1"
              >
                <div className="size-4 bg-background border border-border/20 rounded-md flex items-center justify-center">
                  <Icon name="build" size={12} />
                </div>
                {tool.integrationId}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Input Parameters Section */}
      {step.inputSchema && (
        <div className="bg-background border-b border-border p-4">
          <div
            className="nodrag"
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-mono text-sm text-muted-foreground uppercase mb-4">
              INPUT PARAMETERS
            </p>
            <div className="flex flex-col gap-5">
              {inputSchemaEntries.map(([key, schema]: [string, unknown]) => {
                const schemaObj = schema as Record<string, unknown>;
                const description =
                  typeof schemaObj.description === "string"
                    ? schemaObj.description
                    : "";

                // Get the current value from step.input
                const currentValue = step.input?.[key];
                const stringValue =
                  typeof currentValue === "string"
                    ? currentValue
                    : currentValue !== undefined
                      ? JSON.stringify(currentValue, null, 2)
                      : "";

                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-foreground leading-none">
                        {key}
                      </label>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onCreateInputView(key)}
                        className="text-xs h-6 px-2"
                      >
                        + Add View
                      </Button>
                    </div>

                    <RichTextEditor
                      placeholder={description || `Enter ${key}...`}
                      minHeight="40px"
                      value={stringValue}
                      onChange={(newValue) => {
                        // Update the step input in the workflow store
                        const updatedInput = {
                          ...step.input,
                          [key]: newValue,
                        };
                        workflowActions.updateStep(step.name, {
                          input: updatedInput,
                        });
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export const StepNode = memo(function StepNode({
  data,
}: NodeProps<StepNodeData>) {
  // 🔵 PERFORMANCE LOGGING
  const renderCount = useRef(0);
  useEffect(() => {
    renderCount.current++;
    console.log(`🔵 [StepNode:${data.stepId}] RENDER #${renderCount.current}`);
  });

  // OPTIMIZED: Only subscribe to zoom, and add equality check to prevent re-renders
  const zoom = useStore(
    (s) => s.transform[2],
    (a, b) => Math.abs(a - b) < 0.01,
  );
  const [showJsonView, setShowJsonView] = useState(false);
  const [_creatingInputViewFor, setCreatingInputViewFor] = useState<
    string | null
  >(null);
  const [renderingInputView, setRenderingInputView] = useState<{
    fieldName: string;
    viewName: string;
    viewCode: string;
  } | null>(null);

  const workflow = useCurrentWorkflow();
  const step = workflow?.steps?.find(
    (s: WorkflowStep) => s.name === data.stepId,
  );
  const workflowActions = useWorkflowStoreActions();

  const executeStepMutation = useExecuteStep();

  const compact = zoom < 0.7;

  // OPTIMIZED: Only compute when actually needed (when showJsonView is true)
  const inputSchemaEntries = useMemo((): Array<[string, unknown]> => {
    if (!step?.inputSchema) return [];
    return Object.entries(
      (step.inputSchema as Record<string, unknown>).properties || {},
    );
  }, [step?.inputSchema]);

  // OPTIMIZED: Only compute JSON when viewing JSON (expensive operation)
  const jsonViewData = useMemo((): { jsonString: string; lines: string[] } => {
    if (!step || !showJsonView) return { jsonString: "", lines: [] };
    const jsonString = JSON.stringify(step, null, 2);
    const lines = jsonString.split("\n");
    return { jsonString, lines };
  }, [step, showJsonView]);

  // OPTIMIZED: Extract stable values to reduce callback recreation
  const stepName = step?.name;
  const stepExecute = step?.execute;
  const stepInputSchema = step?.inputSchema;
  const stepOutputSchema = step?.outputSchema;
  const stepInput = step?.input;
  const authToken = workflow?.authorization?.token;

  // Memoize the execute step handler with stable dependencies
  const handleExecuteStep = useCallback(() => {
    if (!step || !stepName) return;

    // Collect outputs from all previous steps for @ref resolution
    const previousStepResults: Record<string, unknown> = {};
    const currentStepIndex = workflow?.steps?.findIndex(
      (s: WorkflowStep) => s.name === stepName,
    );

    if (currentStepIndex !== undefined && currentStepIndex > 0) {
      // Get all steps before the current one
      const previousSteps = workflow?.steps?.slice(0, currentStepIndex);

      previousSteps?.forEach((prevStep: WorkflowStep) => {
        // Only include steps that have successful execution with output data
        if (
          prevStep.output &&
          typeof prevStep.output === "object" &&
          "success" in prevStep.output &&
          prevStep.output.success &&
          "output" in prevStep.output
        ) {
          previousStepResults[prevStep.name] = prevStep.output;
        }
      });
    }

    console.log(
      "🔍 [StepNode] Executing step with previousStepResults:",
      previousStepResults,
    );

    executeStepMutation.mutate(
      {
        step: {
          id: stepName,
          name: stepName,
          code: (stepExecute || "") as string,
          inputSchema: (stepInputSchema || {}) as any,
          outputSchema: (stepOutputSchema || {}) as any,
          input: (stepInput || {}) as any,
        },
        previousStepResults,
        authToken,
      },
      {
        onSuccess: async (result) => {
          const resolvedResult = await result;
          console.log(
            "✅ [StepNode] Step executed successfully:",
            resolvedResult,
          );

          workflowActions.updateStep(stepName, {
            output: resolvedResult as unknown as Record<string, unknown>,
          });

          if (resolvedResult.success) {
            console.log("💾 [StepNode] Saved step output to store");
          } else {
            console.error(
              "❌ [StepNode] Step execution failed:",
              resolvedResult.error,
            );
          }
        },
        onError: (error) => {
          console.error("❌ [StepNode] Step execution error:", error);
          const errorData: Record<string, unknown> = {
            error: String(error),
          };
          workflowActions.updateStep(stepName, {
            output: errorData,
          });
        },
      },
    );
  }, [
    workflow?.steps,
    step,
    stepName,
    stepExecute,
    stepInputSchema,
    stepOutputSchema,
    stepInput,
    authToken,
    executeStepMutation,
    workflowActions,
  ]);

  if (!step) return null;

  if (compact) {
    return (
      <div className="rounded-xl border bg-card p-3 w-[320px] shadow-sm hover:shadow-md transition-shadow cursor-pointer">
        <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
        <Handle
          type="source"
          position={Position.Right}
          style={{ opacity: 0 }}
        />
        <div className="flex items-start gap-2">
          <Icon
            name={"build"}
            size={18}
            className="text-muted-foreground flex-shrink-0 mt-0.5"
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-foreground truncate">
              {step.name}
            </div>
            <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
              {step.description}
            </div>
          </div>
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 bg-muted-foreground`}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-foreground border border-border rounded-xl p-[2px] w-[640px]">
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />

      {/* Header */}
      <div className="flex items-center justify-between h-10 px-4 py-2 rounded-t-xl overflow-clip">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Icon name={"build"} size={16} className="shrink-0 text-background" />
          <span className="text-sm font-medium text-background leading-5 truncate">
            {step.name}
          </span>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowJsonView(!showJsonView)}
            className="size-5 flex items-center justify-center hover:opacity-70 transition-opacity nodrag"
            title={showJsonView ? "Show form view" : "Show JSON view"}
          >
            <Icon name="code" size={20} className="text-muted-foreground" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="size-5 flex items-center justify-center hover:opacity-70 transition-opacity nodrag"
              >
                <Icon
                  name="more_horiz"
                  size={20}
                  className="text-muted-foreground"
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  if (workflow) void 0;
                }}
              >
                <Icon name="content_copy" size={16} className="mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const newTitle = prompt("Enter new name:", step.name);
                  if (newTitle && workflow) {
                    void 0;
                  }
                }}
              >
                <Icon name="edit" size={16} className="mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (workflow && confirm(`Delete step "${step.name}"?`)) {
                    void 0;
                  }
                }}
                className="text-destructive"
              >
                <Icon name="delete" size={16} className="mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col rounded-xl overflow-hidden">
        {showJsonView && (
          <JsonView
            jsonString={jsonViewData.jsonString}
            lines={jsonViewData.lines}
          />
        )}
        {!showJsonView && (
          <StepFormView
            step={step}
            inputSchemaEntries={inputSchemaEntries}
            workflowActions={workflowActions}
            onCreateInputView={setCreatingInputViewFor}
          />
        )}

        {/* Execute Button Section */}
        <div className="bg-background border-b border-border p-4">
          <div
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-3"
          >
            {/* Execution Status Indicator */}
            {hasSuccessOutput(step.output) && <StepSuccessIndicator />}
            {hasErrorOutput(step.output) && <StepErrorIndicator />}

            <div className="flex-1" />

            {/* Execute Button */}
            <Button
              onClick={handleExecuteStep}
              disabled={executeStepMutation.isPending}
              className="bg-primary-light text-primary-dark hover:bg-[#c5e015] h-8 px-3 py-2 rounded-xl text-sm font-medium leading-5 nodrag disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {executeStepMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-primary-dark/20 border-t-primary-dark rounded-full animate-spin" />
                  Executing...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Icon name="play_arrow" size={16} />
                  Execute step
                </span>
              )}
            </Button>
          </div>

          {/* Error Details */}
          {hasErrorOutput(step.output) && (
            <StepError error={step.output.error} />
          )}
        </div>
      </div>

      {/* Render Input View Modal */}
      {renderingInputView && workflow && step && (
        <RenderInputViewModal
          step={step}
          fieldName={renderingInputView.fieldName}
          viewName={renderingInputView.viewName}
          viewCode={renderingInputView.viewCode}
          open={!!renderingInputView}
          onOpenChange={(open) => {
            if (!open) setRenderingInputView(null);
          }}
          onSubmit={(data) => {
            console.log("📝 [StepNode] Input view submitted:", data);

            // Update the field value
          }}
        />
      )}

      {/* Render Output View - only if output exists and has success property */}
      {hasExecutionResult(step.output) && <StepOutput step={step.output} />}
    </div>
  );
});

import {
  useWorkflowStepData,
  useIsExecuteEditorOpen,
} from "../../../stores/workflows/hooks.ts";
import { memo, useMemo } from "react";
import { useWorkflowRunQuery } from "../../workflows/workflow-run-detail.tsx";
import { WorkflowStepInput } from "./input";
import { StepError } from "./error.tsx";
import { StepOutput } from "./output.tsx";
import { StepHeader } from "./header.tsx";
import { StepAttempts } from "./attempts.tsx";
import { StepToolsUsed } from "./tools-used.tsx";
import { StepFooter } from "./footer.tsx";
import { StepExecuteEditor } from "./execute-editor.tsx";

/**
 * Derives the step status from execution properties (works for both runtime and definition steps)
 */
function deriveStepStatus(execution: {
  success?: boolean | null;
  error?: { message?: string; name?: string } | null;
  start?: string | null;
  end?: string | null;
}): string | undefined {
  if (
    execution.success == null &&
    !execution.error &&
    !execution.start &&
    !execution.end
  )
    return;
  // If step has error, it failed
  if (execution.error) return "failed";

  // If step has ended successfully
  if (execution.end && execution.success === true) return "completed";

  // If step has ended but not successfully
  if (execution.end && execution.success === false) return "failed";

  // If step has started but not ended, it's running
  if (execution.start && !execution.end) return "running";

  // Otherwise, it's pending
  return "pending";
}

interface WorkflowStepCardProps {
  stepName: string;
}

export const WorkflowDefinitionStepCard = memo(
  function WorkflowDefinitionStepCard({ stepName }: WorkflowStepCardProps) {
    const stepData = useWorkflowStepData(stepName);
    const isExecuteEditorOpen = useIsExecuteEditorOpen(stepName);

    const execution = stepData.execution as
      | {
          start?: string | null;
          end?: string | null;
          error?: { name?: string; message?: string } | null;
          success?: boolean | null;
        }
      | undefined;

    const status = useMemo(() => {
      if (execution) {
        return deriveStepStatus(execution);
      }
      return undefined;
    }, [execution]);


    const hasInputs = useMemo(() => {
      const properties = stepData.definition?.inputSchema?.properties as Record<string, unknown> | undefined;
      return properties && Object.keys(properties).length > 0;
    }, [stepData.definition]);

    return (
      <div className="rounded-xl p-1 bg-card shadow-xs min-w-0">
        <StepHeader stepName={stepName} status={status} />
        <div className="bg-background rounded-xl shadow-xs overflow-hidden min-w-0">
          {isExecuteEditorOpen && <StepExecuteEditor stepName={stepName} />}
          {hasInputs && (
            <div className="border-b border-base-border bg-background p-4 space-y-3 min-w-0 overflow-hidden">
              <p className="font-mono text-sm text-muted-foreground uppercase leading-5">
                Inputs
              </p>
              <WorkflowStepInput stepName={stepName} />
            </div>
          )}
          <StepContent
            stepName={stepName}
            output={stepData.output}
            views={stepData.views}
            error={execution?.error}
          />
        </div>
        <StepFooter
          startTime={execution?.start}
          endTime={execution?.end}
          status={status}
          cost={undefined}
        />
      </div>
    );
  },
  (prevProps, nextProps) => prevProps.stepName === nextProps.stepName,
);

export const WorkflowRunStepCard = memo(
  function WorkflowRunStepCard({ stepName }: WorkflowStepCardProps) {
    const stepData = useWorkflowStepData(stepName);
    const runData = useWorkflowRunQuery();

    const runtimeStep = useMemo(() => {
      return runData?.data?.data?.workflowStatus?.steps?.find(
        (step) => step.name === stepName,
      );
    }, [runData?.data?.data?.workflowStatus?.steps, stepName]);

    const execution = useMemo<
      | {
          start?: string | null;
          end?: string | null;
          error?: { name?: string; message?: string } | null;
          success?: boolean;
        }
      | undefined
    >(
      () =>
        runtimeStep as
          | {
              start?: string | null;
              end?: string | null;
              error?: { name?: string; message?: string } | null;
              success?: boolean;
            }
          | undefined,
      [runtimeStep],
    );

    const output = useMemo(() => {
      return runtimeStep?.output;
    }, [runtimeStep]);

    const status = useMemo(() => {
      if (execution) {
        return deriveStepStatus(execution);
      }
      return undefined;
    }, [execution]);

    return (
      <div className="rounded-xl p-1 bg-card shadow-xs min-w-0">
        <StepHeader type="runtime" stepName={stepName} status={status} />
        <div className="bg-background rounded-xl shadow-xs overflow-hidden min-w-0">
          <StepContent
            stepName={stepName}
            output={output}
            views={stepData.views}
            error={execution ? execution.error : undefined}
            attempts={runtimeStep?.attempts}
          />
        </div>
        <StepFooter
          startTime={execution?.start}
          endTime={execution?.end}
          status={status}
          cost={
            runtimeStep &&
            typeof runtimeStep === "object" &&
            "cost" in runtimeStep
              ? (runtimeStep.cost as number)
              : undefined
          }
        />
      </div>
    );
  },
  (prevProps, nextProps) => prevProps.stepName === nextProps.stepName,
);

interface StepContentProps {
  stepName: string;
  error?: { name?: string; message?: string } | null;
  output?: unknown;
  attempts?: Array<{
    success?: boolean | null;
    error?: { message?: string; name?: string } | null;
    start?: string | null;
    end?: string | null;
  }>;
  views?: readonly string[];
}

const StepContent = memo(function StepContent({
  stepName,
  error,
  output,
  attempts,
  views,
}: StepContentProps) {
  const hasContent =
    error ||
    (output !== undefined && output !== null) ||
    (attempts && attempts.length > 1);

  if (!hasContent) return null;

  return (
    <>
      <StepToolsUsed stepName={stepName} />
      <StepError error={error} />
      <StepOutput output={output} views={views} />
      <StepAttempts attempts={attempts || []} />
    </>
  );
});

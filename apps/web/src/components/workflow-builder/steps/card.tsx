import { useWorkflowStepData } from "../../../stores/workflows/hooks.ts";
import { memo, useMemo } from "react";
import { useWorkflowRunQuery } from "../../workflows/workflow-run-detail.tsx";
import { WorkflowStepInput } from "./input";
import { StepError } from "./error.tsx";
import { StepOutput } from "./output.tsx";
import { StepHeader } from "./header.tsx";
import { StepAttempts } from "./attempts.tsx";
import { StepTimeInfo } from "../../workflows/workflow-step-card.tsx";

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
    !execution.success &&
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

    return (
      <div className={`rounded-xl p-1 bg-[#fafafa] shadow-xs`}>
        <StepHeader stepName={stepName} />
        <WorkflowStepInput stepName={stepName} />
        <StepContent
          output={stepData.output}
          views={stepData.views}
          error={execution?.error}
        />
        <StepTimeInfo
          startTime={execution?.start}
          endTime={execution?.end}
          status={status}
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
      <div className={`rounded-xl p-1 bg-[#fafafa] shadow-xs`}>
        <StepHeader stepName={stepName} status={status} />
        <StepContent
          output={output}
          views={stepData.views}
          error={execution ? execution.error : undefined}
          attempts={runtimeStep?.attempts}
        />
        <StepTimeInfo
          startTime={execution?.start}
          endTime={execution?.end}
          status={status}
        />
      </div>
    );
  },
  (prevProps, nextProps) => prevProps.stepName === nextProps.stepName,
);

interface StepContentProps {
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
    <div className="bg-background rounded-xl p-3 space-y-3">
      <StepError error={error} />
      <StepOutput output={output} views={views} />
      <StepAttempts attempts={attempts || []} />
    </div>
  );
});

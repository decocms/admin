import { Icon } from "@deco/ui/components/icon.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { memo, useCallback } from "react";
import { StepStatusBadge } from "./status";
import { StepTitle } from "./title";
import { useStepRunner } from "./use-step-runner";
import { useWorkflowStepInput } from "../../../stores/workflows/hooks.ts";
import { Spinner } from "@deco/ui/components/spinner.tsx";

interface StepHeaderProps {
  stepName: string;
  description?: string;
  status?: string;
}

export const StepHeader = memo(function StepHeader({
  stepName,
  description,
  status,
}: StepHeaderProps) {
  const isFailed = status === "failed";
  const isRunning = status === "running";
  const { runStep, isSubmitting } = useStepRunner(stepName);
  const currentInput = useWorkflowStepInput(stepName);

  const handleRunStep = useCallback(async () => {
    if (currentInput && typeof currentInput === "object") {
      await runStep(currentInput as Record<string, unknown>);
    }
  }, [runStep, currentInput]);

  return (
    <div
      className={cn(
        "px-4 py-2 flex items-center justify-between gap-2",
        isFailed && "text-destructive",
      )}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Icon name="flag" size={16} className="text-foreground" />
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <StepTitle stepName={stepName} description={description} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="text-sm font-medium"
          size="sm"
          onClick={handleRunStep}
          disabled={isSubmitting || isRunning}
        >
          {isSubmitting || isRunning ? (
            <>
              <Spinner size="xs" />
              Running
            </>
          ) : (
            <>
              <Icon name="play_arrow" size={16} />
              Run step
            </>
          )}
        </Button>
        {status && <StepStatusBadge status={status} />}
      </div>
    </div>
  );
});

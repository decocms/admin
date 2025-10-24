import { Icon } from "@deco/ui/components/icon.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { memo, useCallback } from "react";
import { StepTitle } from "./title";
import { useStepRunner } from "./use-step-runner";
import { useWorkflowStepInput } from "../../../stores/workflows/hooks.ts";
import { Spinner } from "@deco/ui/components/spinner.tsx";

interface StepHeaderProps {
  stepName: string;
  description?: string;
  status?: string;
  type?: "definition" | "runtime";
}

export const StepHeader = memo(function StepHeader({
  stepName,
  description,
  status,
  type = "definition",
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
        "px-4 py-2 flex items-center justify-between overflow-hidden rounded-t-xl",
        isFailed && "text-destructive",
      )}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Icon name="flag" size={16} className="text-foreground shrink-0" />
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <div className="flex items-center gap-2 w-full">
            <StepTitle stepName={stepName} description={description} />
            {type === "definition" ? (
              <>
                {/* <div className="flex items-center gap-0 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-xl p-0"
            >
              <Icon
                name="more_horiz"
                size={20}
                className="text-muted-foreground"
              />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-xl p-0"
            >
              <Icon
                name="open_in_full"
                size={20}
                className="text-muted-foreground"
              />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-xl p-0"
            >
              <Icon name="code" size={20} className="text-muted-foreground" />
            </Button>
          </div> */}
                <Button
                  type="button"
                  variant="outline"
                  className="text-sm font-medium h-8 px-3 py-2 gap-2 shrink-0"
                  onClick={handleRunStep}
                  disabled={isSubmitting || isRunning}
                >
                  {isSubmitting || isRunning ? (
                    <>
                      <Spinner size="xs" />
                      <span className="text-sm leading-5">Running</span>
                    </>
                  ) : (
                    <>
                      <Icon name="play_arrow" size={11} />
                      <span className="text-sm leading-5">Re-run</span>
                    </>
                  )}
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
});

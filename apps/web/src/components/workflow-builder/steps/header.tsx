import { Icon } from "@deco/ui/components/icon.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { memo, useCallback } from "react";
import { StepTitle } from "./title";
import { useStepRunner } from "./use-step-runner";
import {
  useWorkflowStepInput,
  useIsExecuteEditorOpen,
} from "../../../stores/workflows/hooks.ts";
import { useWorkflowStore } from "../../../stores/workflows/provider.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import type { Store } from "../../../stores/workflows/store.ts";

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
  const isExecuteEditorOpen = useIsExecuteEditorOpen(stepName);

  // Directly access the toggle action from the store
  const toggleExecuteEditor = useWorkflowStore(
    (state: Store) => state.toggleExecuteEditor,
    Object.is,
  );

  const handleRunStep = useCallback(async () => {
    if (currentInput && typeof currentInput === "object") {
      await runStep(currentInput as Record<string, unknown>);
    }
  }, [runStep, currentInput]);

  const handleToggleExecuteEditor = useCallback(() => {
    if (toggleExecuteEditor) {
      toggleExecuteEditor(stepName);
    }
  }, [toggleExecuteEditor, stepName]);

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
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "size-8 rounded-xl p-0",
                    isExecuteEditorOpen && "bg-accent text-accent-foreground",
                  )}
                  onClick={handleToggleExecuteEditor}
                  title="View/Edit Execute Code"
                >
                  <Icon
                    name="code"
                    size={20}
                    className={
                      isExecuteEditorOpen
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }
                  />
                </Button>
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
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
});

import { type NodeProps, Handle, Position } from "reactflow";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { RichTextEditor } from "../../RichTextEditor";
import { useGenerateStep } from "../../../hooks/useGenerateStep";
import { useCurrentWorkflow } from "@/store/workflow";
import { useStepEditorPrompt } from "@/store/step-editor";
import { memo } from "react";
import type { WorkflowStep } from "shared/types/workflows";

export const NewStepNode = memo(function NewStepNode(_props: NodeProps) {
  const workflow = useCurrentWorkflow();
  const generateStepMutation = useGenerateStep();
  const prompt = useStepEditorPrompt();

  const handleGenerateStep = () => {
    if (!prompt.trim() || !workflow) {
      console.warn("⚠️ Empty prompt or no workflow");
      return;
    }

    console.log("⚡ [NewStepNode] Generating step with prompt:", prompt);

    interface StepInfo {
      id: string;
      name: string;
      outputSchema: Record<string, unknown>;
    }
    const previousSteps: StepInfo[] | undefined = workflow.steps?.map(
      (step: WorkflowStep): StepInfo => ({
        id: step.name,
        name: step.name,
        outputSchema: (step.outputSchema as Record<string, unknown>) || {},
      }),
    );

    generateStepMutation.mutate({ objective: prompt, previousSteps });
  };

  return (
    <div className="bg-secondary border-2 border-dashed border-border rounded-xl p-[2px] w-[640px]">
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />

      {/* Header */}
      <div className="flex items-center justify-between h-10 px-4 py-2 rounded-t-xl overflow-clip">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Icon name="stars" size={16} className="shrink-0 text-foreground" />
          <span className="text-sm font-medium text-foreground leading-5 truncate">
            New step
          </span>
          <div className="size-5 shrink-0 ml-auto" />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col rounded-xl overflow-clip">
        {/* Input Section */}
        <div className="bg-background border-b border-border p-4">
          <div
            className="nodrag"
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2">
              <label className="text-sm font-medium text-foreground">
                What should this step do?
              </label>
            </div>
            <RichTextEditor
              placeholder="Type @ to mention tools or steps"
              minHeight="120px"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="bg-background flex items-center justify-end gap-2 p-4">
          <div
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              onClick={handleGenerateStep}
              disabled={!prompt.trim() || generateStepMutation.isPending}
              className="bg-primary-light text-primary-dark hover:bg-[#c5e015] h-8 px-3 py-2 rounded-xl text-sm font-medium leading-5 nodrag"
            >
              {generateStepMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-primary-dark/20 border-t-primary-dark rounded-full animate-spin" />
                  Generating...
                </span>
              ) : (
                "Generate step"
              )}
            </Button>
          </div>
        </div>
      </div>

      {generateStepMutation.isError && (
        <div className="mx-2 mb-2 p-3 bg-destructive/10 border border-destructive/50 rounded-lg">
          <p className="text-sm text-destructive m-0">
            {generateStepMutation.error?.message || "Failed to generate step"}
          </p>
        </div>
      )}
    </div>
  );
});

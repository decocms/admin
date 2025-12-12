import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Play, Zap } from "lucide-react";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardHeader, CardTitle } from "@deco/ui/components/card.tsx";
import { cn } from "@deco/ui/lib/utils.js";
import { useWorkflowBindingConnection } from "@/web/hooks/workflows/use-workflow-binding-connection";
import { useToolCallMutation } from "@/web/hooks/use-tool-call";
import { createToolCaller } from "@/tools/client";
import {
  useIsAddingStep,
  useTrackingExecutionId,
  useWorkflow,
  useWorkflowActions,
} from "@/web/stores/workflow";

// ============================================
// Workflow Start Hook
// ============================================

function useWorkflowStart() {
  const { id: connectionId } = useWorkflowBindingConnection();
  const { setTrackingExecutionId } = useWorkflowActions();
  const toolCaller = createToolCaller(connectionId);
  const workflow = useWorkflow();

  const { mutateAsync: startWorkflow, isPending } = useToolCallMutation({
    toolCaller,
    toolName: "WORKFLOW_START",
  });

  const handleRunWorkflow = async () => {
    const result = await startWorkflow({
      workflowId: workflow.id,
      input: {},
    });
    const executionId =
      (result as { executionId: string }).executionId ??
      (result as { structuredContent: { executionId: string } })
        .structuredContent.executionId;
    setTrackingExecutionId(executionId);
  };

  return { handleRunWorkflow, isPending };
}

function useWorkflowCancel() {
  const { id: connectionId } = useWorkflowBindingConnection();
  const toolCaller = createToolCaller(connectionId);
  const trackingExecutionId = useTrackingExecutionId();

  const { mutateAsync: cancelWorkflow, isPending } = useToolCallMutation({
    toolCaller,
    toolName: "CANCEL_EXECUTION",
  });

  const handleCancelWorkflow = async () => {
    await cancelWorkflow({
      executionId: trackingExecutionId,
    });
  };

  return { handleCancelWorkflow, isPending };
}

// ============================================
// Trigger Node Component
// ============================================

export const TriggerNode = memo(function TriggerNode() {
  const { handleRunWorkflow } = useWorkflowStart();
  const isAddingStep = useIsAddingStep();

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleRunWorkflow();
  };

  const triggerIcon = (() => {
    return (
      <Play className="w-4 h-4 text-foreground cursor-pointer hover:text-primary transition-colors" />
    );
  })();

  return (
    <div className="relative">
      <div className="flex flex-col items-start">
        <div className="bg-muted border-border text-muted-foreground h-5 flex items-center gap-1 border px-2 py-1 rounded-t-md w-fit ml-2 border-b-0">
          <Zap size={13} className="text-muted-foreground block" />
          <span className="uppercase font-normal font-mono text-xs leading-3 text-muted-foreground block mt-px">
            Trigger
          </span>
        </div>
        <Card
          className={cn(
            "w-[180px] min-w-[180px] p-0 px-3 h-12 group flex items-center justify-center relative",
            "transition-all duration-200",
            // Highlight when in add-step mode
            isAddingStep
              ? [
                  "cursor-pointer",
                  "ring-2 ring-primary/30 ring-offset-1 ring-offset-background",
                  "hover:ring-primary hover:ring-offset-2",
                  "hover:shadow-lg hover:shadow-primary/20",
                  "hover:scale-[1.02]",
                ]
              : "cursor-pointer",
          )}
        >
          <CardHeader className="flex items-center justify-between gap-2 p-0 w-full">
            <div className="flex flex-1 items-center gap-2 min-w-0">
              <div className="h-6 w-6 p-1 shrink-0 flex items-center justify-center rounded-md">
                <Button variant="ghost" size="xs" onClick={handleTriggerClick}>
                  {triggerIcon}
                </Button>
              </div>

              <CardTitle className="p-0 text-sm font-medium truncate">
                Manual
              </CardTitle>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Source handle - hidden */}
      <Handle type="source" position={Position.Bottom} style={{ bottom: -8 }} />
    </div>
  );
});

export default TriggerNode;

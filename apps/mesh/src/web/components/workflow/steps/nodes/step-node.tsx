import { useRef, useSyncExternalStore } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { BellIcon, CheckIcon, ClockIcon, CodeXml, Wrench } from "lucide-react";
import type {
  Step,
  StepAction,
  WaitForSignalAction,
  WorkflowExecutionStepResult,
} from "@decocms/bindings/workflow";
import {
  Card,
  CardAction,
  CardHeader,
  CardTitle,
} from "@deco/ui/components/card.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.js";
import {
  useWorkflowActions,
  useIsAddingStep,
  useTrackingExecutionId,
  useIsDraftStep,
  useCurrentStepName,
} from "@/web/stores/workflow";
import type { StepNodeData } from "../use-workflow-flow";
import { createToolCaller } from "@/tools/client";
import { useWorkflowBindingConnection } from "@/web/hooks/workflows/use-workflow-binding-connection";
import { useToolCallMutation } from "@/web/hooks/use-tool-call";
import { Spinner } from "@deco/ui/components/spinner.js";
import { usePollingWorkflowExecution } from "@/web/hooks/workflows/use-workflow-collection-item";

// ============================================
// Duration Component
// ============================================

function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) return `${milliseconds}ms`;

  const totalSeconds = milliseconds / 1000;
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  if (hours > 0) return `${hours}h ${minutes}m ${seconds.toFixed(1)}s`;
  if (minutes > 0) return `${minutes}m ${seconds.toFixed(1)}s`;
  return `${seconds.toFixed(1)}s`;
}

function Duration({
  startTime,
  endTime,
  isRunning,
}: {
  startTime: string | null | undefined;
  endTime: string | null | undefined;
  isRunning: boolean;
}) {
  const timeRef = useRef(Date.now());

  const subscribe = (callback: () => void) => {
    if (!isRunning) return () => {};
    const interval = setInterval(() => {
      timeRef.current = Date.now();
      callback();
    }, 100);
    return () => clearInterval(interval);
  };

  const getSnapshot = () => {
    return isRunning ? timeRef.current : 0;
  };

  const currentTime = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  if (!startTime) return null;

  const start = new Date(startTime).getTime();
  let duration: number;

  if (endTime) {
    duration = Math.max(0, new Date(endTime).getTime() - start);
  } else if (isRunning) {
    duration = Math.max(0, currentTime - start);
  } else {
    return null;
  }

  return (
    <span className="text-xs text-muted-foreground tabular-nums">
      {formatDuration(duration)}
    </span>
  );
}

// ============================================
// Step Menu
// ============================================

function StepMenu({ step }: { step: Step }) {
  const { deleteStep } = useWorkflowActions();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="h-7 w-7 p-0 text-muted-foreground flex items-center justify-end rounded-lg cursor-pointer">
        <Icon name="more_horiz" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => deleteStep(step.name)}>
          <Icon name="delete" className="w-4 h-4 text-muted-foreground" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================
// Step Icon
// ============================================

function getStepIcon(step: Step) {
  const { action } = step;

  if ("toolName" in action) {
    return <Wrench className="w-4 h-4" />;
  }
  if ("code" in action) {
    return <CodeXml className="w-4 h-4" />;
  }
  if ("sleepMs" in action || "sleepUntil" in action) {
    return <ClockIcon className="w-4 h-4" />;
  }
  if ("signalName" in action) {
    return <BellIcon className="w-4 h-4" />;
  }

  return <Wrench className="w-4 h-4" />;
}

// ============================================
// Step Node Component
// ============================================

function checkIfIsWaitForSignalAction(
  action: StepAction,
): action is WaitForSignalAction {
  return "signalName" in action;
}

function useSendSignalMutation() {
  const { id: connectionId } = useWorkflowBindingConnection();
  const toolCaller = createToolCaller(connectionId);

  const { mutateAsync: sendSignal, isPending } = useToolCallMutation({
    toolCaller,
    toolName: "SEND_SIGNAL",
  });

  const handleSendSignal = async (
    executionId: string,
    signalName: string,
    payload: unknown,
  ): Promise<{
    success: boolean;
    signalId: string | undefined;
    message: string | undefined;
  }> => {
    const result = await sendSignal({
      executionId,
      signalName,
      payload,
    });
    return result as {
      success: boolean;
      signalId: string | undefined;
      message: string | undefined;
    };
  };

  return { sendSignal: handleSendSignal, isPending };
}

function getStepStyle(
  step: Step,
  stepResult?: WorkflowExecutionStepResult | null,
) {
  const isSignal = checkIfIsWaitForSignalAction(step.action);
  if (!stepResult) return "default";
  if (stepResult.error) return "error";
  if (!stepResult.output) return "pending";
  if (stepResult.output) return "success";
  if (isSignal && !stepResult.completed_at_epoch_ms)
    return "waiting_for_signal";
  return "default";
}

export const StepNode = function StepNode({ data }: NodeProps) {
  const { step } = data as StepNodeData;
  const trackingExecutionId = useTrackingExecutionId();
  const isAddingStep = useIsAddingStep();
  const { addDependencyToDraftStep, cancelAddingStep } = useWorkflowActions();
  const { sendSignal, isPending: isSendingSignal } = useSendSignalMutation();
  const currentStepName = useCurrentStepName();
  const isDraftStep = useIsDraftStep(step.name);
  const { item: pollingExecution } =
    usePollingWorkflowExecution(trackingExecutionId);

  const stepResult = pollingExecution?.step_results.find(
    (s) => s.step_id === step.name,
  );
  const isConsumed = !!stepResult?.output;
  const style = getStepStyle(step, stepResult);

  const displayIcon = (() => {
    if (!step.action) return null;
    if (
      step.action &&
      checkIfIsWaitForSignalAction(step.action) &&
      isConsumed
    ) {
      return <CheckIcon className="w-4 h-4 text-primary-foreground" />;
    }
    return getStepIcon(step);
  })();

  const handleClick = (e: React.MouseEvent) => {
    if (isAddingStep) {
      if (isDraftStep) {
        cancelAddingStep();
        return;
      }
      e.stopPropagation();
      addDependencyToDraftStep(step.name);
    }
  };

  const handleIconClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      step.action &&
      checkIfIsWaitForSignalAction(step.action) &&
      trackingExecutionId
    ) {
      sendSignal(
        trackingExecutionId,
        step.action.signalName,
        stepResult?.output,
      );
    }
  };

  return (
    <div className="group relative">
      {/* Target handle - hidden, just for receiving edges */}
      <Handle
        type="target"
        position={Position.Top}
        className="bg-transparent w-1 h-1 border-0 opacity-0"
      />

      <Card
        onClick={handleClick}
        className={cn(
          "w-[180px] min-w-[180px] p-0 px-3 h-12 flex items-center justify-center relative",
          isDraftStep && "border-brand-purple-light bg-brand-purple-light/5",
          "transition-all duration-200",
          style === "pending" && "animate-pulse border-warning",
          style === "error" && "border-destructive",
          style === "success" && "border-success",
          style === "waiting_for_signal" && "border-primary animate-pulse",
          // Highlight when in add-step mode
          isAddingStep
            ? [
                "cursor-pointer",
                !isDraftStep &&
                  "ring-2 ring-primary/30 ring-offset-1 ring-offset-background",
                isDraftStep &&
                  "ring-brand-purple-light/30 ring-offset-brand-purple-light/5 hover:bg-destructive/5! hover:border-destructive! hover:scale-[1]!",
                !isDraftStep && "hover:ring-primary hover:ring-offset-2",
                !isDraftStep && "hover:shadow-lg hover:shadow-primary/20",
                "hover:scale-[1.02]",
              ]
            : "cursor-pointer",
          currentStepName === step.name && "bg-primary/10 border-primary",
        )}
      >
        <CardHeader className="flex items-center justify-between gap-2 p-0 w-full">
          <div className="flex flex-1 items-center gap-2 min-w-0">
            <div
              className="h-6 w-6 p-1 shrink-0 flex items-center justify-center rounded-md bg-primary"
              onClick={handleIconClick}
            >
              {isSendingSignal ? <Spinner size="xs" /> : displayIcon}
            </div>

            <CardTitle className="p-0 text-sm font-medium truncate">
              {step.name}
            </CardTitle>

            <Duration
              startTime={stepResult?.created_at}
              endTime={
                stepResult?.completed_at_epoch_ms
                  ? new Date(stepResult.completed_at_epoch_ms).toISOString()
                  : undefined
              }
              isRunning={
                trackingExecutionId
                  ? stepResult?.completed_at_epoch_ms === null
                  : false
              }
            />
          </div>

          <CardAction className="group-hover:opacity-100 opacity-0 transition-opacity shrink-0">
            <StepMenu step={step} />
          </CardAction>
        </CardHeader>
      </Card>

      {/* Source handle - hidden */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="bg-transparent w-1 h-1 border-0 opacity-0"
      />
    </div>
  );
};

export default StepNode;

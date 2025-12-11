import { memo, useRef, useSyncExternalStore } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  BellIcon,
  CheckIcon,
  ClockIcon,
  CodeXml,
  Repeat,
  Wrench,
} from "lucide-react";
import type {
  Step,
  StepAction,
  WaitForSignalAction,
  LoopConfig,
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
import { useLoopIterations } from "../use-step-execution";
import { createToolCaller } from "@/tools/client";
import { useWorkflowBindingConnection } from "@/web/hooks/workflows/use-workflow-binding-connection";
import { useToolCallMutation } from "@/web/hooks/use-tool-call";
import { Spinner } from "@deco/ui/components/spinner.js";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";

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
// Loop Indicator
// ============================================

function getLoopDescription(loop: LoopConfig): string {
  if (loop.for) {
    const limit = loop.limit ? ` (max ${loop.limit})` : "";
    return `Iterates over ${loop.for.items}${limit}`;
  }
  if (loop.until) {
    return `Repeats until ${loop.until.path} ${loop.until.condition ?? "="} ${loop.until.value}`;
  }
  if (loop.while) {
    return `Repeats while ${loop.while.path} ${loop.while.condition} ${loop.while.value}`;
  }
  return "Loop step";
}

function LoopIndicator({
  loop,
  iterationCount,
  isRunning,
}: {
  loop: LoopConfig;
  iterationCount: number;
  isRunning: boolean;
}) {
  const limit = loop.limit;
  const hasProgress = iterationCount > 0 || isRunning;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "flex items-center gap-0.5 text-[10px] font-medium rounded-full px-1.5 py-0.5",
            "bg-muted/80 text-muted-foreground",
            isRunning && "animate-pulse bg-primary/20 text-primary",
          )}
        >
          <Repeat className="w-2.5 h-2.5" />
          {hasProgress && (
            <span className="tabular-nums">
              {limit ? `${iterationCount}/${limit}` : `×${iterationCount}`}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs max-w-[200px]">
        {getLoopDescription(loop)}
      </TooltipContent>
    </Tooltip>
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

export const StepNode = memo(function StepNode({ data }: NodeProps) {
  const { step, stepResult, style } = data as StepNodeData;
  const trackingExecutionId = useTrackingExecutionId();
  const isAddingStep = useIsAddingStep();
  const { addDependencyToDraftStep, cancelAddingStep } = useWorkflowActions();
  const { sendSignal, isPending: isSendingSignal } = useSendSignalMutation();
  const { iterationCount, isLoopRunning } = useLoopIterations(step.name);
  const currentStepName = useCurrentStepName();
  const isDraftStep = useIsDraftStep(step.name);
  const isConsumed = !!stepResult?.output;
  const hasLoop = !!step.config?.loop;
  const isRunning =
    !!stepResult?.created_at &&
    !stepResult?.completed_at_epoch_ms &&
    !stepResult?.error;

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
    console.log("handleClick", isAddingStep, step.name);
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
          currentStepName === step.name && "bg-primary/10 border-primary",
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
              isRunning={isRunning}
            />

            {hasLoop && (
              <LoopIndicator
                loop={step.config!.loop!}
                iterationCount={iterationCount}
                isRunning={isLoopRunning || isRunning}
              />
            )}
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
});

export default StepNode;

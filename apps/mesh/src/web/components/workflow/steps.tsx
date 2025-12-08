import {
  useTrackingExecutionId,
  useWorkflow,
  useWorkflowActions,
  useWorkflowSteps,
} from "@/web/stores/workflow";
import {
  SleepAction,
  WaitForSignalAction,
  WorkflowExecutionStepResult,
  WorkflowExecutionStreamChunk,
} from "@decocms/bindings/workflow";
import { useWorkflowBindingConnection } from "@/web/hooks/workflows/use-workflow-binding-connection";
import { BellIcon, ClockIcon, CodeXml, Lock, Zap } from "lucide-react";
import { Step } from "@decocms/bindings/workflow";
import { ToolCallAction } from "@decocms/bindings/workflow";
import { CodeAction } from "@decocms/bindings/workflow";
import { Button } from "@deco/ui/components/button.tsx";
import { Plus } from "lucide-react";
import { ChevronDown } from "lucide-react";

function MarchingAntsBorder({
  className,
  color,
  enabled,
}: {
  className?: string;
  color: string;
  enabled: boolean;
}) {
  return (
    <svg
      className={`absolute inset-0 w-full h-full pointer-events-none ${
        className ?? ""
      }`}
      preserveAspectRatio="none"
    >
      <rect
        x="1"
        y="1"
        width="calc(100% - 2px)"
        height="calc(100% - 2px)"
        rx="6"
        ry="6"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeDasharray="12 14"
        className={enabled ? "marching-ants-stroke" : ""}
      />
    </svg>
  );
}
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Card,
  CardAction,
  CardHeader,
  CardTitle,
} from "@deco/ui/components/card.tsx";
import { cn } from "@deco/ui/lib/utils.js";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { useScrollFade } from "../selectable-list";
import { useMemo, useState } from "react";
import { useToolCallMutation } from "@/web/hooks/use-tool-call";
import { createToolCaller } from "@/tools/client";
import { useStreamWorkflowExecution } from "../details/workflow-execution";

export function getStepResults(
  stepName: string,
  allResults: WorkflowExecutionStepResult[] | undefined,
  allChunks?: WorkflowExecutionStreamChunk[],
): WorkflowExecutionStepResult[] {
  if (!allResults) return [];

  if (allChunks) {
    const chunks = allChunks.filter((chunk) => chunk.step_id === stepName);
    const output = chunks.map((chunk) => chunk.chunk_data);

    return [
      {
        step_id: stepName,
        input: {},
        output,
        completed_at_epoch_ms: Date.now(),
        id: stepName,
        title: stepName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        execution_id: stepName,
        created_by: "system",
        updated_by: "system",
      },
    ];
  }
  // Match both exact name and forEach iterations like "stepName[0]", "stepName[1]", etc.
  const pattern = new RegExp(`^${stepName}(\\[\\d+\\])?$`);
  return allResults.filter((result) => pattern.test(result.step_id));
}

function useWorkflowStart() {
  const { id: connectionId } = useWorkflowBindingConnection();
  const { setTrackingExecutionId } = useWorkflowActions();
  const toolCaller = useMemo(
    () => createToolCaller(connectionId),
    [connectionId],
  );
  const workflow = useWorkflow();
  const { mutateAsync: startWorkflow, isPending: isWorkflowStartPending } =
    useToolCallMutation({
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
  return { handleRunWorkflow, isWorkflowStartPending };
}

function WorkflowTrigger() {
  const { handleRunWorkflow, isWorkflowStartPending } = useWorkflowStart();
  const steps = useWorkflowSteps();
  const workflowConnectionId = useWorkflowBindingConnection();
  const manualTriggerStep = useMemo(
    () => steps.find((step) => step.name === "Manual"),
    [steps],
  );
  const triggerIcon = useMemo(() => {
    return isWorkflowStartPending ? (
      <Spinner size="xs" />
    ) : (
      <Icon
        onClick={handleRunWorkflow}
        name="play_arrow"
        className="w-4 h-4 text-foreground hover:text-primary transition-colors cursor-pointer"
      />
    );
  }, [isWorkflowStartPending]);
  const { isFetched } = useStepResults();

  return (
    <div>
      <div
        className="bg-muted border-border text-muted-foreground h-5 flex items-center gap-1 border px-2 py-1 rounded-t-md w-fit ml-2 border-b-0"
        onClick={handleRunWorkflow}
      >
        <Zap size={13} className="text-muted-foreground block" />
        <span className="uppercase font-normal font-mono text-xs text-muted-foreground block mt-px">
          Trigger
        </span>
      </div>
      <StepCard
        style={isFetched ? "success" : undefined}
        icon={triggerIcon}
        step={
          manualTriggerStep ?? {
            name: "Manual",
            action: {
              toolName: "WORKFLOW_START",
              connectionId: workflowConnectionId.id,
            },
          }
        }
      />
    </div>
  );
}

function ForEachStep({ step }: { step: Step }) {
  const [isHovering, setIsHovering] = useState(false);
  const handleMouseEnter = () => {
    setIsHovering(true);
  };
  const handleMouseLeave = () => {
    setIsHovering(false);
  };
  const scroll = useScrollFade();
  const trackingExecutionId = useTrackingExecutionId();
  const { data, isLoading } = useStreamWorkflowExecution(trackingExecutionId);
  const { isFetching } = useStepResults();
  const stepResults = getStepResults(
    step.name,
    data?.item?.step_results,
    data?.item?.stream_chunks,
  );
  return (
    <div
      className="rounded-md px-3 pt-4 relative h-full bg-transparent"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {
        <MarchingAntsBorder
          enabled={isLoading}
          color={isHovering ? "#CCC" : "#D8D8D8"}
        />
      }
      <span
        className={cn(
          "text-base text-muted-foreground absolute -top-[12px] left-3 p-0 bg-background",
        )}
      >
        Loop
      </span>
      <ScrollArea
        hideScrollbar
        className="max-h-[200px]"
        contentClassName="gap-2"
        ref={scroll.ref}
        onScroll={scroll.onScroll}
        style={
          scroll.showFade
            ? {
                maskImage:
                  "linear-gradient(to bottom, black calc(100% - 24px), transparent 100%)",
              }
            : undefined
        }
      >
        {stepResults.map((result, index) => (
          <div
            key={result.step_id}
            className={cn(
              "cursor-pointer",
              index === stepResults.length - 1 && "pb-2",
            )}
          >
            <StepCard
              style={isFetching ? "pending" : "success"}
              step={{ ...step, name: result.step_id }}
              icon={
                <div className="h-8 w-8 bg-primary text-primary-foreground flex items-center justify-center rounded-lg">
                  <CodeXml className="w-4 h-4" />
                </div>
              }
            />
          </div>
        ))}
      </ScrollArea>
    </div>
  );
}

function useStepResults() {
  const steps = useWorkflowSteps();
  const trackingExecutionId = useTrackingExecutionId();
  const { data, isLoading, isFetching, isFetched } =
    useStreamWorkflowExecution(trackingExecutionId);
  const stepResults = useMemo(() => {
    return steps.map((step) =>
      getStepResults(step.name, data?.item?.step_results),
    );
  }, [steps, data?.item?.step_results]);
  const firstPendingStep = useMemo(() => {
    const firstPendingStep = stepResults
      .flat()
      .findLast((r) => !r.output)?.step_id;
    return firstPendingStep; // -1 if all steps have results
  }, [stepResults]);
  return {
    stepResults,
    firstPendingStep,
    isFetching,
    isFetched,
    isLoading,
  };
}

export function WorkflowSteps() {
  const steps = useWorkflowSteps();
  const trackingExecutionId = useTrackingExecutionId();
  const { isLoading } = useStepResults();
  return (
    <div className="flex flex-col gap-2 h-full w-full">
      <WorkflowTrigger />
      <FlowLine index={0} showContinueLine={true} isLoading={isLoading} />
      {steps.map((step, index) => {
        const isForEach = !!step.config?.forEach && !!trackingExecutionId;
        return (
          <div
            key={step.name + index}
            className="flex flex-col gap-2 h-full bg-transparent"
          >
            {isForEach ? (
              <ForEachStep step={step} />
            ) : (
              <StepByType key={step.name} step={step} action={step.action} />
            )}
            <FlowLine
              isLoading={isLoading}
              index={index + 1}
              showContinueLine={index < steps.length - 1}
            />
          </div>
        );
      })}
    </div>
  );
}

function useStepResult(stepName: string) {
  const { stepResults, isFetching } = useStepResults();
  const stepResult = useMemo(() => {
    return stepResults.flat().findLast((r) => r.step_id === stepName);
  }, [stepResults, stepName]);
  return { stepResult, isFetching };
}

function useSendSignal() {
  const { id: connectionId } = useWorkflowBindingConnection();
  const toolCaller = useMemo(
    () => createToolCaller(connectionId),
    [connectionId],
  );
  const trackingExecutionId = useTrackingExecutionId();
  const { mutateAsync: sendSignal, isPending: isSendSignalPending } =
    useToolCallMutation({
      toolCaller,
      toolName: "SEND_SIGNAL",
    });
  const handleSendSignal = async ({
    signalName,
    payload,
  }: {
    signalName: string;
    payload: unknown;
  }) => {
    await sendSignal({
      executionId: trackingExecutionId,
      signalName,
      payload,
    });
  };
  return { handleSendSignal, isSendSignalPending };
}

function StepByType({
  step,
  action,
}: {
  step: Step;
  action: ToolCallAction | CodeAction | SleepAction | WaitForSignalAction;
}) {
  const { handleSendSignal, isSendSignalPending } = useSendSignal();
  return (
    <>
      {"toolName" in action && (
        <StepCard
          step={step as Step & { action: ToolCallAction }}
          icon={<CodeXml className="w-4 h-4" />}
        />
      )}
      {"code" in action && (
        <StepCard
          step={step as Step & { action: CodeAction }}
          icon={<CodeXml className="w-4 h-4" />}
        />
      )}
      {("sleepMs" in action || "sleepUntil" in action) && (
        <StepCard
          step={step}
          icon={<ClockIcon className="w-4 h-4 text-muted-foreground" />}
        />
      )}
      {"signalName" in action && (
        <StepCard
          step={step}
          icon={<BellIcon className="w-4 h-4 text-muted-foreground" />}
          action={() =>
            handleSendSignal({ signalName: action.signalName, payload: {} })
          }
        />
      )}
    </>
  );
}

function FlowLine({
  index,
  showContinueLine,
  isLoading,
}: {
  index: number;
  showContinueLine: boolean;
  isLoading: boolean;
}) {
  const { addStepAtIndex } = useWorkflowActions();

  const handleNewStep = (index: number) => {
    addStepAtIndex(index, { type: "wait_for_signal" });
  };
  return (
    <div className="flex flex-col gap-2 items-center justify-center mb-2">
      <div className="w-[2px] h-10 bg-border" />
      <Button
        className="border-primary border h-6 w-6"
        variant="ghost"
        disabled={!!isLoading}
        type="button"
        size="xs"
        onClick={() => handleNewStep(index)}
      >
        {!!isLoading && <Lock className="w-4 h-4 text-primary-foreground" />}
        {!!!isLoading && <Plus className="w-4 h-4 text-primary-foreground" />}
      </Button>
      {showContinueLine && (
        <div className="relative">
          <div className="w-[2px] h-10 bg-border" />
          <ChevronDown className="w-5 h-5 text-border absolute -bottom-2.5 left-1/2 -translate-x-1/2" />
        </div>
      )}
    </div>
  );
}

function StepMenu({ step }: { step: Step }) {
  const { deleteStep } = useWorkflowActions();
  const isManual =
    "toolName" in step.action &&
    step.action.toolName === "WORKFLOW_START" &&
    step.name === "Manual";

  const actions = useMemo(() => {
    return [
      ...(!isManual
        ? [
            {
              label: "Delete",
              icon: "delete",
              onClick: () => deleteStep(step.name),
            },
          ]
        : []),
    ];
  }, [isManual, deleteStep, step.name]);

  if (actions.length === 0) return null;
  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <Icon name="more_horiz" className="w-4 h-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {actions.map((action) => (
            <DropdownMenuItem key={action.label} onClick={action.onClick}>
              <Icon
                name={action.icon}
                className="w-4 h-4 text-muted-foreground"
              />
              {action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export const StepCard = ({
  step,
  icon,
  style,
  action,
}: {
  step: Step;
  icon: React.ReactNode;
  style?: "success" | "error" | "pending" | "trigger" | undefined;
  action?: () => void;
}) => {
  const { setCurrentStepName } = useWorkflowActions();
  const { isFetching, stepResult } = useStepResult(step.name);

  const derivedStyle = useMemo(() => {
    if (style) return style;
    if (stepResult?.error) return "error";
    if (isFetching && !stepResult?.output) return "pending";
    if (stepResult?.output) return "success";
    return undefined;
  }, [isFetching, style, stepResult]);

  const handleClick = () => {
    setCurrentStepName(step.name);
    action?.();
  };
  console.log("step", step);
  return (
    <Card
      onClick={handleClick}
      className={cn(
        "w-full border px-4 py-[18px] group",
        derivedStyle === "pending" && "animate-pulse border-warning",
        derivedStyle === "error" && "border-destructive",
        derivedStyle === "success" && "border-success",
        derivedStyle === "trigger" && "border-primary",
      )}
    >
      <CardHeader className="flex items-center justify-between gap-2 p-0">
        <div className="flex flex-1 items-center gap-2">
          {icon}
          <CardTitle className="p-0 text-base font-medium truncate">
            {step.name}
          </CardTitle>
        </div>
        <CardAction className="group-hover:opacity-100 opacity-0 transition-opacity">
          <StepMenu step={step} />
        </CardAction>
      </CardHeader>
    </Card>
  );
};

import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  Workflow,
  WorkflowExecutionWithStepResults,
} from "@decocms/bindings/workflow";
import { ViewActions, ViewLayout, ViewTabs } from "../layout";
import { WorkflowSteps } from "./components/steps/index";
import {
  useCurrentStepName,
  useCurrentTab,
  useTrackingExecutionId,
  useWorkflow,
  useWorkflowActions,
  WorkflowStoreProvider,
} from "@/web/components/details/workflow/stores/workflow";
import {
  useWorkflowCollectionItem,
  useWorkflowExecutionCollectionItem,
  useWorkflowExecutionCollectionList,
} from "./hooks/use-workflow-collection-item";
import { WorkflowActions } from "./components/actions";
import { StepTabs, WorkflowTabs } from "./components/tabs";
import { toast } from "@deco/ui/components/sonner.tsx";
import { MonacoCodeEditor } from "./components/monaco-editor";
import {
  Select,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from "@deco/ui/components/select.js";
import { ClockIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.js";
export interface WorkflowDetailsViewProps {
  itemId: string;
  onBack: () => void;
  onUpdate: (updates: Record<string, unknown>) => Promise<void>;
}

export function WorkflowDetailsView({
  itemId,
  onBack,
}: WorkflowDetailsViewProps) {
  const { item, update } = useWorkflowCollectionItem(itemId);

  if (!item) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <WorkflowStoreProvider workflow={item}>
      <WorkflowDetails
        onBack={onBack}
        onUpdate={async (updates) => {
          try {
            update(updates);
            toast.success("Workflow updated successfully");
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "Failed to update workflow",
            );
            throw error;
          }
        }}
      />
    </WorkflowStoreProvider>
  );
}

export function WorkflowExecutionDetailsView({
  itemId,
  onBack,
}: WorkflowDetailsViewProps) {
  const { item } = useWorkflowExecutionCollectionItem(itemId);
  const { item: workflow, update: updateWorkflow } = useWorkflowCollectionItem(
    item?.workflow_id ?? "",
  );
  if (!workflow) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <WorkflowStoreProvider workflow={workflow} trackingExecutionId={itemId}>
      <WorkflowDetails
        onBack={onBack}
        onUpdate={async (updates) => {
          try {
            updateWorkflow(updates);
            toast.success("Workflow updated successfully");
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "Failed to update workflow",
            );
            throw error;
          }
        }}
      />
    </WorkflowStoreProvider>
  );
}

interface WorkflowDetailsProps {
  onBack: () => void;
  onUpdate: (updates: Record<string, unknown>) => Promise<void>;
}

export interface StreamResponse {
  item: WorkflowExecutionWithStepResults | null;
  error?: string;
}

function WorkflowCode({
  workflow,
  onUpdate,
}: {
  workflow: Workflow;
  onUpdate: (updates: Record<string, unknown>) => Promise<void>;
}) {
  const { setWorkflow } = useWorkflowActions();
  const wf = {
    title: workflow.title,
    description: workflow.description,
    steps: workflow.steps,
  };
  return (
    <MonacoCodeEditor
      height="100%"
      code={JSON.stringify(wf, null, 2)}
      language="json"
      onSave={(code) => {
        const parsed = JSON.parse(code);
        setWorkflow({
          ...workflow,
          ...parsed,
        });
        onUpdate(parsed);
      }}
    />
  );
}

function useCurrentExecution() {
  const trackingExecutionId = useTrackingExecutionId();
  const { item: execution } =
    useWorkflowExecutionCollectionItem(trackingExecutionId);
  return execution;
}

export function useIsExecutionScheduled(id?: string) {
  const { item: execution } = useWorkflowExecutionCollectionItem(id);
  const currentTime = Date.now();
  return (
    (execution?.start_at_epoch_ms ?? 0) > currentTime &&
    execution?.status !== "success" &&
    execution?.status !== "error"
  );
}

export function ExecutionScheduleTooltip({ id }: { id?: string }) {
  const { item: execution } = useWorkflowExecutionCollectionItem(id);
  return (
    <Tooltip>
      <TooltipTrigger>
        <ClockIcon size={12} />
      </TooltipTrigger>
      <TooltipContent>
        <p>
          This execution is scheduled to start at{" "}
          {new Date(execution?.start_at_epoch_ms ?? 0).toLocaleString()}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

function ExecutionItem({ id }: { id: string }) {
  const isScheduled = useIsExecutionScheduled(id);
  const { item: execution } = useWorkflowExecutionCollectionItem(id);
  return (
    <div>
      {isScheduled && <ExecutionScheduleTooltip id={id} />}
      <h3>
        {new Date(execution?.created_at ?? 0).toLocaleString()} -{" "}
        {execution?.status}
      </h3>
    </div>
  );
}

export function WorkflowDetails({ onBack, onUpdate }: WorkflowDetailsProps) {
  const currentTab = useCurrentTab();
  const currentStepName = useCurrentStepName();
  const workflow = useWorkflow();
  const { list: executions } = useWorkflowExecutionCollectionList({
    workflowId: workflow.id,
  });
  const { setTrackingExecutionId } = useWorkflowActions();
  const currentExecution = useCurrentExecution();
  return (
    <ViewLayout onBack={onBack}>
      <ViewTabs>
        <div className="flex items-center gap-3 font-sans">
          <h2 className="text-base font-normal text-foreground">
            {workflow.title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {workflow.description}
          </p>
        </div>
        <div className="flex items-center gap-3 font-sans">
          <Select
            value={currentExecution?.id}
            onValueChange={(value) => setTrackingExecutionId(value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an execution" />
            </SelectTrigger>
            <SelectContent>
              {executions.map((execution) => (
                <SelectItem key={execution.id} value={execution.id}>
                  <ExecutionItem id={execution.id} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </ViewTabs>

      <ViewActions>
        <WorkflowActions onUpdate={onUpdate} />
      </ViewActions>

      {/* Main Content */}
      <div className="flex w-full h-full bg-background overflow-hidden relative">
        <div className="absolute top-4 left-4 z-50">
          <WorkflowTabs />
        </div>
        <div className="flex-1 h-full">
          {currentTab === "steps" ? (
            <WorkflowSteps />
          ) : (
            <div className="h-[calc(100%-60px)]">
              <WorkflowCode workflow={workflow} onUpdate={onUpdate} />
            </div>
          )}
        </div>
        {currentStepName && currentTab === "steps" && <StepTabs />}
      </div>
    </ViewLayout>
  );
}

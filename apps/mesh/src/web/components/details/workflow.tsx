import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  Workflow,
  WorkflowExecutionWithStepResults,
} from "@decocms/bindings/workflow";
import { ViewActions, ViewLayout, ViewTabs } from "./layout";
import { WorkflowSteps } from "../workflow/steps/index";
import {
  useCurrentStepName,
  useCurrentTab,
  useWorkflow,
  WorkflowStoreProvider,
} from "@/web/stores/workflow";
import {
  useWorkflowCollectionItem,
  useWorkflowExecutionCollectionItem,
} from "@/web/hooks/workflows/use-workflow-collection-item";
import { WorkflowActions } from "../workflow/actions";
import { StepTabs, WorkflowTabs } from "../workflow/tabs";
import { toast } from "@deco/ui/components/sonner.tsx";
import { MonacoCodeEditor } from "../monaco-editor";
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
        onUpdate(parsed);
      }}
    />
  );
}

export function WorkflowDetails({ onBack, onUpdate }: WorkflowDetailsProps) {
  const currentTab = useCurrentTab();
  const currentStepName = useCurrentStepName();
  const workflow = useWorkflow();

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

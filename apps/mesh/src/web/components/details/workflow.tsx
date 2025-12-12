import { Spinner } from "@deco/ui/components/spinner.tsx";
import { WorkflowExecutionWithStepResults } from "@decocms/bindings/workflow";
import { ViewActions, ViewLayout, ViewTabs } from "./layout";
import { WorkflowSteps } from "../workflow/steps/index";
import {
  useCurrentStepName,
  WorkflowStoreProvider,
} from "@/web/stores/workflow";
import { useWorkflowCollectionItem } from "@/web/hooks/workflows/use-workflow-collection-item";
import { WorkflowActions } from "../workflow/actions";
import { StepTabs, WorkflowTabs } from "../workflow/tabs";
import { toast } from "@deco/ui/components/sonner.tsx";
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

interface WorkflowDetailsProps {
  onBack: () => void;
  onUpdate: (updates: Record<string, unknown>) => Promise<void>;
}

export interface StreamResponse {
  item: WorkflowExecutionWithStepResults | null;
  error?: string;
}

export function WorkflowDetails({ onBack, onUpdate }: WorkflowDetailsProps) {
  const currentStepName = useCurrentStepName();

  return (
    <ViewLayout onBack={onBack}>
      <ViewTabs>
        <WorkflowTabs />
      </ViewTabs>

      <ViewActions>
        <WorkflowActions onUpdate={onUpdate} />
      </ViewActions>

      {/* Main Content */}
      <div className="flex w-full h-full bg-background overflow-hidden">
        <div className="flex-1 h-full">
          <WorkflowSteps />
        </div>
        {currentStepName && <StepTabs />}
      </div>
    </ViewLayout>
  );
}

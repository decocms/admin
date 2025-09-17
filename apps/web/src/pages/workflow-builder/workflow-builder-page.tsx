import { useParams } from "react-router";
import {
  WorkflowDisplayCanvas,
  type DisplayWorkflow,
} from "../../components/workflow-builder/workflow-display-canvas.tsx";
import { useSandboxWorkflow } from "@deco/sdk";
import { WorkflowErrorState } from "./workflow-error-state.tsx";
import { WorkflowLoadingSkeleton } from "./workflow-loading-skeleton.tsx";
import { WorkflowNotFoundState } from "./workflow-not-found-state.tsx";

export default function WorkflowBuilderPage() {
  const { org, project, workflowName } = useParams();

  if (!org || !project || !workflowName) {
    return (
      <WorkflowErrorState error="Missing required parameters: org, project, or workflowName" />
    );
  }

  const {
    data: workflow,
    isLoading,
    error,
    refetch,
  } = useSandboxWorkflow(workflowName);

  if (isLoading) return <WorkflowLoadingSkeleton />;
  if (error)
    return <WorkflowErrorState error={error?.message || "Unknown error"} />;
  if (!workflow) return <WorkflowNotFoundState workflowName={workflowName} />;

  // The workflow from useSandboxWorkflow is already in the correct format
  return (
    <WorkflowDisplayCanvas
      workflow={workflow as unknown as DisplayWorkflow} // Type assertion to handle the mismatch
      onRefresh={async () => {
        await refetch();
      }}
      isLoading={isLoading}
    />
  );
}

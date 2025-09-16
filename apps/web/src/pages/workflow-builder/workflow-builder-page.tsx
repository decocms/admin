import { useParams } from "react-router";
import { WorkflowCanvas } from "../../components/workflow-builder/workflow-canvas.tsx";
import { useWorkflow } from "@deco/sdk";
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

  const { workflow, isLoading, error } = useWorkflow(workflowName);

  if (isLoading) return <WorkflowLoadingSkeleton />;
  if (error) return <WorkflowErrorState error={error} />;
  if (!workflow) return <WorkflowNotFoundState workflowName={workflowName} />;

  return <WorkflowCanvas workflow={workflow} />;
}

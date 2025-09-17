import { useWorkflowByUri } from "@deco/sdk";
import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { WorkflowErrorState } from "../../pages/workflow-builder/workflow-error-state.tsx";
import { WorkflowLoadingSkeleton } from "../../pages/workflow-builder/workflow-loading-skeleton.tsx";
import { WorkflowNotFoundState } from "../../pages/workflow-builder/workflow-not-found-state.tsx";
import { WorkflowCanvas } from "../workflow-builder/workflow-canvas.tsx";

export function WorkflowView() {
  const [searchParams] = useSearchParams();

  // Extract workflow URI from the URL parameters
  const workflowUri = useMemo(() => {
    const viewUrl = searchParams.get("viewUrl");
    if (!viewUrl) return null;

    try {
      const url = new URL(viewUrl.replace("internal://", "https://internal/"));
      return url.searchParams.get("uri");
    } catch {
      return null;
    }
  }, [searchParams]);

  if (!workflowUri) {
    return (
      <WorkflowErrorState error="Missing workflow URI in URL parameters" />
    );
  }

  const { workflow, isLoading, error } = useWorkflowByUri(workflowUri);

  if (isLoading) return <WorkflowLoadingSkeleton />;
  if (error) return <WorkflowErrorState error={error} />;
  if (!workflow) return <WorkflowNotFoundState workflowName={workflowUri} />;

  return <WorkflowCanvas workflow={workflow} />;
}

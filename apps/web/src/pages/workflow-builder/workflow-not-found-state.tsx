import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useNavigate } from "react-router";

interface WorkflowNotFoundStateProps {
  workflowName: string;
}

export function WorkflowNotFoundState({
  workflowName,
}: WorkflowNotFoundStateProps) {
  const navigate = useNavigate();

  return (
    <div className="h-screen w-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 max-w-md text-center">
        <Icon name="file-x" className="h-12 w-12 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-semibold">Workflow Not Found</h2>
          <p className="text-muted-foreground mt-2">
            The workflow "{workflowName}" does not exist. You can create a new
            workflow by adding tools and mappers to the canvas.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate(-1)} variant="outline">
            Go Back
          </Button>
          <Button onClick={() => globalThis.location.reload()}>
            Create New Workflow
          </Button>
        </div>
      </div>
    </div>
  );
}

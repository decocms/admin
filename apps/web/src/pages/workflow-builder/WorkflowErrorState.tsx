import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useNavigate } from "react-router";

interface WorkflowErrorStateProps {
  error: string;
}

export function WorkflowErrorState({ error }: WorkflowErrorStateProps) {
  const navigate = useNavigate();

  return (
    <div className="h-screen w-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 max-w-md text-center">
        <Icon name="alert-circle" className="h-12 w-12 text-destructive" />
        <div>
          <h2 className="text-lg font-semibold">Failed to Load Workflow</h2>
          <p className="text-muted-foreground mt-2">{error}</p>
        </div>
        <Button onClick={() => navigate(-1)} variant="outline">
          Go Back
        </Button>
      </div>
    </div>
  );
}

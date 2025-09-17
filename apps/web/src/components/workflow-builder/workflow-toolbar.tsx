import { Button } from "@deco/ui/components/button.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { CheckCircle, Play, Save } from "lucide-react";

interface WorkflowToolbarProps {
  workflowName: string;
  isDirty: boolean;
  onSave: () => void;
  onRun: () => void;
  isSaving?: boolean;
  isRunning?: boolean;
}

/**
 * Toolbar for workflow actions
 * Clean and simple with clear status indicators
 */
export function WorkflowToolbar({
  workflowName,
  isDirty,
  onSave,
  onRun,
  isSaving,
  isRunning,
}: WorkflowToolbarProps) {
  return (
    <div className="h-16 border-b bg-white px-6 flex items-center justify-between shadow-sm">
      {/* Workflow name and status */}
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold">{workflowName}</h1>
        {isDirty && !isSaving && (
          <span className="text-sm text-warning font-medium">
            • Unsaved changes
          </span>
        )}
        {isSaving && (
          <span className="text-sm text-primary font-medium flex items-center gap-1">
            <Spinner size="xs" />
            Saving...
          </span>
        )}
        {!isDirty && !isSaving && (
          <span className="text-sm text-success font-medium flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Saved
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          onClick={onSave}
          disabled={!isDirty || isSaving || isRunning}
          className="min-w-[100px]"
        >
          {isSaving ? (
            <>
              <Spinner size="xs" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save
            </>
          )}
        </Button>

        <Button
          onClick={onRun}
          disabled={isSaving || isRunning || isDirty}
          className="min-w-[100px]"
        >
          {isRunning ? (
            <>
              <Spinner size="xs" />
              Running...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Run
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

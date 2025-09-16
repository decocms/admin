import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";

interface WorkflowToolbarProps {
  isDirty: boolean;
  onGenerate: () => void;
  onRun: () => void;
}

export function WorkflowToolbar({
  isDirty,
  onGenerate,
  onRun,
}: WorkflowToolbarProps) {
  return (
    <div className="absolute top-4 left-4 z-10">
      <div className="bg-background border rounded-lg shadow-lg p-4 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Icon name="account_tree" className="h-5 w-5" />
          <span className="font-semibold">Workflow Builder</span>
          {isDirty && (
            <Badge variant="destructive" className="text-xs">
              Unsaved Changes
            </Badge>
          )}
        </div>

        <div className="h-4 w-px bg-border" />

        <div className="flex gap-2">
          {isDirty ? (
            <Button onClick={onGenerate} size="sm">
              <Icon name="auto_fix_high" className="h-4 w-4 mr-2" />
              Generate Workflow
            </Button>
          ) : (
            <Button onClick={onRun} size="sm" variant="default">
              <Icon name="play_arrow" className="h-4 w-4 mr-2" />
              Run Workflow
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

import {
  useIsDirty,
  useTrackingExecutionId,
  useWorkflow,
  useWorkflowActions,
} from "@/web/stores/workflow";
import { Icon } from "@deco/ui/components/icon.js";
import { Button } from "@deco/ui/components/button.js";

export function WorkflowActions({
  onUpdate,
}: {
  onUpdate: (updates: Record<string, unknown>) => Promise<void>;
}) {
  const {
    resetToOriginalWorkflow,
    setTrackingExecutionId,
    setOriginalWorkflow,
  } = useWorkflowActions();
  const workflow = useWorkflow();
  const trackingExecutionId = useTrackingExecutionId();
  const isDirty = useIsDirty();
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-muted-foreground font-normal"
        onClick={() => resetToOriginalWorkflow()}
        disabled={!isDirty}
      >
        <Icon name="refresh" className="w-4 h-4" />
        Reset
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-muted-foreground font-normal"
        onClick={() => {
          setTrackingExecutionId(undefined);
        }}
        disabled={!trackingExecutionId}
      >
        <Icon name="clear" className="w-4 h-4" />
        Clear
      </Button>
      <Button
        className="bg-[#d0ec1a] text-[#07401a] hover:bg-[#d0ec1a]/90 h-7 text-xs font-medium"
        onClick={() => {
          onUpdate(workflow).then(() => {
            setOriginalWorkflow(workflow);
          });
        }}
        disabled={!isDirty}
      >
        Save changes
      </Button>
    </>
  );
}

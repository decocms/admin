import { memo, useCallback } from "react";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useWorkflowActions } from "../../stores/workflows/index";

export const ResetWorkflowButton = memo(function ResetWorkflowButton() {
  const { resetAndResync } = useWorkflowActions();

  const handleReset = useCallback(() => {
    resetAndResync();
  }, [resetAndResync]);

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleReset}
      className="flex items-center gap-2"
      title="Clear local changes and resync with server"
    >
      <Icon name="refresh" size={18} />
      Reset
    </Button>
  );
});

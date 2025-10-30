import { memo, useCallback } from "react";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useUpsertWorkflow } from "@deco/sdk";
import { toast } from "@deco/ui/components/sonner.tsx";
import {
  useDirtySteps,
  useIsDirty,
  useGetWorkflowToSave,
  useHandleSaveSuccess,
} from "../../stores/workflows/hooks.ts";

export const SaveWorkflowButton = memo(function SaveWorkflowButton() {
  const isDirty = useIsDirty();
  const dirtySteps = useDirtySteps();
  const getWorkflowToSave = useGetWorkflowToSave();
  const handleSaveSuccess = useHandleSaveSuccess();
  const { mutateAsync, isPending } = useUpsertWorkflow();

  const hasChanges = isDirty || dirtySteps.length > 0;

  const handleSave = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const workflowToSave = getWorkflowToSave();

      try {
        await mutateAsync(workflowToSave);
        handleSaveSuccess(workflowToSave);

        toast.success("Workflow saved", {
          description:
            dirtySteps.length > 0
              ? `Updated ${dirtySteps.length} step${dirtySteps.length > 1 ? "s" : ""}`
              : "Changes saved successfully",
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to save workflow",
        );
      }
    },
    [getWorkflowToSave, handleSaveSuccess, mutateAsync, dirtySteps.length],
  );

  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      onClick={handleSave}
      disabled={!hasChanges || isPending}
      title={
        !hasChanges
          ? "No unsaved changes"
          : dirtySteps.length > 0
            ? `Save workflow (${dirtySteps.length} step${dirtySteps.length > 1 ? "s" : ""} edited)`
            : "Save workflow"
      }
    >
      {isPending ? (
        <>
          <Spinner size="xs" />
          Saving...
        </>
      ) : (
        <>
          <Icon name="save" />
          Save
        </>
      )}
    </Button>
  );
});

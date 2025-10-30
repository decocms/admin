import { memo, useCallback } from "react";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useUpsertWorkflow } from "@deco/sdk";
import { toast } from "@deco/ui/components/sonner.tsx";
import {
  useIsDirty,
  useHandleSaveSuccess,
  useWorkflow,
  useWorkflowUri,
} from "../../stores/workflows/hooks.ts";

export const SaveWorkflowButton = memo(function SaveWorkflowButton() {
  const isDirty = useIsDirty();
  const handleSaveSuccess = useHandleSaveSuccess();
  const { mutateAsync, isPending } = useUpsertWorkflow();
  const workflow = useWorkflow();
  const workflowUri = useWorkflowUri();

  const handleSave = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();

      try {
        const response = await mutateAsync({
          workflow: workflow,
          uri: workflowUri,
        });
        // Server returns { uri, data, ... } where data is the WorkflowDefinition
        const savedWorkflow = { ...response.data, uri: response.uri };
        handleSaveSuccess(savedWorkflow);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to save workflow",
        );
      }
    },
    [handleSaveSuccess, mutateAsync, workflow, workflowUri],
  );

  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      onClick={handleSave}
      disabled={!isDirty || isPending}
      className="flex items-center gap-2"
      title={!isDirty ? "No unsaved changes" : "Save workflow"}
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

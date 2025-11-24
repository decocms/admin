import { buildAddViewPayload, useAddView, useRemoveView } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";

export interface ViewWithStatus {
  isAdded: boolean;
  teamViewId?: string;
  name?: string;
  url?: string;
  title: string;
  icon: string;
  integration: {
    id: string;
    name: string;
    icon?: string;
    description?: string;
  };
  rules?: string[];
}

export function TogglePin({ view }: { view: ViewWithStatus }) {
  const removeViewMutation = useRemoveView();
  const addViewMutation = useAddView();

  const handleAddView = async (view: ViewWithStatus) => {
    try {
      await addViewMutation.mutateAsync({
        view: buildAddViewPayload({
          view: {
            name: view.name,
            title: view.title,
            icon: view.icon,
            url: view.url,
          },
          integrationId: view.integration.id,
        }),
      });

      toast.success(`View "${view.title}" added successfully`);
    } catch (error) {
      console.error("Error adding view:", error);
      toast.error(`Failed to add view "${view.title}"`);
    }
  };

  const handleRemoveView = async (viewWithStatus: ViewWithStatus) => {
    if (!viewWithStatus.teamViewId) {
      toast.error("No view to remove");
      return;
    }

    try {
      await removeViewMutation.mutateAsync({
        viewId: viewWithStatus.teamViewId,
      });

      toast.success(`View "${viewWithStatus.title}" removed successfully`);
    } catch (error) {
      console.error("Error removing view:", error);
      toast.error(`Failed to remove view "${viewWithStatus.title}"`);
    }
  };

  return (
    <>
      {view.isAdded ? (
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            handleRemoveView(view);
          }}
          disabled={removeViewMutation.isPending}
        >
          {removeViewMutation.isPending ? (
            <Icon name="hourglass_empty" size={14} />
          ) : (
            <Icon name="remove" size={14} />
          )}
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleAddView(view);
          }}
          disabled={addViewMutation.isPending}
        >
          {addViewMutation.isPending ? (
            <Icon name="hourglass_empty" size={14} />
          ) : (
            <Icon name="add" size={14} />
          )}
        </Button>
      )}
    </>
  );
}

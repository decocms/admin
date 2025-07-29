import { NotFoundError, parseViewMetadata, useRemoveView } from "@deco/sdk";
import { useParams } from "react-router";
import { useCurrentTeam } from "../sidebar/team-selector";
import Preview from "../agent/preview";
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@deco/ui/components/alert-dialog.tsx";
import type { Tab } from "../dock/index.tsx";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { useState } from "react";

export default function ViewDetail() {
  const { id } = useParams();
  const team = useCurrentTeam();
  const removeViewMutation = useRemoveView();
  const navigateWorkspace = useNavigateWorkspace();
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);

  const view = team.views.find((view) => view.id === id);
  if (!view) {
    throw new NotFoundError("View not found");
  }
  const meta = parseViewMetadata(view);

  if (meta?.type !== "custom") {
    throw new NotFoundError("View not found");
  }

  const handleDeleteView = async () => {
    try {
      await removeViewMutation.mutateAsync({
        viewId: view.id,
      });

      toast.success(`View "${view.title}" deleted successfully`);
      setShowDeleteAlert(false);
      navigateWorkspace("/"); // Navigate back to the main page after deletion
    } catch (error) {
      console.error("Error deleting view:", error);
      toast.error(`Failed to delete view "${view.title}"`);
      setShowDeleteAlert(false);
    }
  };

  const tabs: Record<string, Tab> = {
    preview: {
      Component: () => <Preview src={meta.url} title={view.title} />,
      title: "Preview",
      initialOpen: true,
      active: true,
    },
  };

  return (
    <>
      <PageLayout
        key={view.id}
        hideViewsButton
        tabs={tabs}
        breadcrumb={
          <DefaultBreadcrumb
            items={[
              {
                label: (
                  <div className="flex items-center gap-2">
                    <Icon name={view.icon} className="w-4 h-4" />
                    <span>{view.title}</span>
                  </div>
                ),
              },
            ]}
          />
        }
        actionButtons={
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowDeleteAlert(true)}
            className="text-muted-foreground hover:text-destructive"
            title="Delete view"
          >
            <Icon name="delete" className="w-4 h-4" />
          </Button>
        }
      />

      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete View</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the view "{view.title}"? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteView}
              disabled={removeViewMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeViewMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

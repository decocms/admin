import { useRecentResources, useSDK, useStartWorkflow } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  memo,
  startTransition,
} from "react";
import { EmptyState } from "../common/empty-state.tsx";
import {
  useWorkflowDescription,
  useWorkflowFirstStepInput,
  useWorkflowName,
  useWorkflowUri,
  useHasFirstStepInput,
} from "../../stores/workflows/hooks.ts";
import {
  createWorkflowStore,
  type Store,
} from "../../stores/workflows/store.ts";
import { WorkflowStoreContext } from "../../stores/workflows/provider.tsx";
import type { StoreApi } from "zustand";
import { DetailSection } from "../common/detail-section.tsx";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { toast } from "@deco/ui/components/sonner.tsx";
import { useResourceWatch } from "../../hooks/use-resource-watch.ts";
import { useQueryClient } from "@tanstack/react-query";
import { resourceKeys } from "@deco/sdk";
import { useWorkflowSync } from "./hooks.ts";
import { WorkflowStepsList } from "./steps.tsx";

interface WorkflowDisplayCanvasProps {
  resourceUri: string;
  onRefresh?: () => Promise<void>;
}

export function WorkflowDisplay({ resourceUri }: WorkflowDisplayCanvasProps) {
  const storeRef = useRef<StoreApi<Store> | null>(null);
  const lastWorkflowNameRef = useRef<string | null>(null);

  const { data: resource, isLoading: isLoadingWorkflow } = useWorkflowSync(
    resourceUri,
    storeRef,
  );
  const workflow = resource?.data;
  const workflowName = workflow?.name;

  const store = useMemo(() => {
    if (!workflow) return null;

    // Only recreate store when workflow name changes (identity check)
    if (storeRef.current && lastWorkflowNameRef.current === workflow.name) {
      return storeRef.current;
    }

    const s = createWorkflowStore({ workflow }, "WorkflowDisplay");
    storeRef.current = s;
    lastWorkflowNameRef.current = workflow.name;

    if (import.meta.env.DEV) {
      console.log(
        "[WorkflowDisplay] 🏪 Created store for workflow:",
        workflow.name,
      );
    }
    return s;
  }, [workflowName]); // Only depend on workflowName (primitive), not workflow object

  if (isLoadingWorkflow && !workflow) {
    return (
      <div className="h-[calc(100vh-12rem)] flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!workflow || !store) {
    return (
      <EmptyState
        icon="error"
        title="Workflow not found"
        description="Could not load workflow"
      />
    );
  }

  return (
    <WorkflowStoreContext.Provider value={store}>
      <Canvas />
    </WorkflowStoreContext.Provider>
  );
}

const StartWorkflowButton = memo(function StartWorkflowButton() {
  const { mutateAsync, isPending } = useStartWorkflow();
  const workflowUri = useWorkflowUri();
  const navigateWorkspace = useNavigateWorkspace();
  const firstStepInput = useWorkflowFirstStepInput();
  const hasFirstStepInput = useHasFirstStepInput();

  const handleStartWorkflow = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      // Prevent any default behavior that might cause page reload
      e.preventDefault();
      e.stopPropagation();

      try {
        await mutateAsync(
          {
            uri: workflowUri,
            input: firstStepInput as Record<string, unknown>,
          },
          {
            onSuccess: (data) => {
              if (!data.uri) return;
              navigateWorkspace(
                `/rsc/i:workflows-management/workflow_run/${encodeURIComponent(data.uri)}`,
              );
            },
          },
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to start workflow",
        );
      }
    },
    [mutateAsync, workflowUri, firstStepInput, navigateWorkspace],
  );

  const isDisabled = isPending || !hasFirstStepInput;

  return (
    <Button
      type="button"
      disabled={isDisabled}
      variant="special"
      onClick={handleStartWorkflow}
      className="min-w-[200px] flex items-center gap-2"
      title={
        !hasFirstStepInput
          ? "Please configure the first step before starting"
          : undefined
      }
    >
      {isPending ? (
        <>
          <Spinner size="xs" /> Starting...
        </>
      ) : (
        <>
          <Icon name="play_arrow" size={18} /> Start Workflow
        </>
      )}
    </Button>
  );
});

/**
 * Interactive workflow canvas that shows a form for workflow input
 * and displays the run results below
 */
export const Canvas = memo(function Canvas() {
  const resourceUri = useWorkflowUri();
  const workflowName = useWorkflowName();
  const workflowDescription = useWorkflowDescription();
  const { locator } = useSDK();
  const projectKey = typeof locator === "string" ? locator : undefined;
  const queryClient = useQueryClient();
  const { addRecent } = useRecentResources(projectKey);
  const hasTrackedRecentRef = useRef(false);
  const store = useContext(WorkflowStoreContext);
  const currentToastIdRef = useRef<string | number | null>(null);

  if (!store) {
    throw new Error("Canvas must be used within WorkflowStoreContext");
  }

  const handleWorkflowUpdate = useCallback(() => {
    if (!locator) return;
    startTransition(() => {
      queryClient.invalidateQueries({
        queryKey: resourceKeys.workflow(locator, resourceUri),
      });
    });
  }, [locator, resourceUri, queryClient]);

  useResourceWatch({
    resourceUri: resourceUri,
    pathFilter: `/src/workflows/${workflowName}.json`,
    enabled: true,
    skipHistorical: true,
    onNewEvent: handleWorkflowUpdate,
  });

  // Subscribe to pendingServerUpdate changes and show toast
  useEffect(() => {
    let previousPendingUpdate = store.getState().pendingServerUpdate;

    const unsubscribe = store.subscribe((state: Store) => {
      const currentPendingUpdate = state.pendingServerUpdate;

      // Only react if pendingServerUpdate actually changed
      if (currentPendingUpdate === previousPendingUpdate) {
        return;
      }

      previousPendingUpdate = currentPendingUpdate;

      // Dismiss any existing toast before showing a new one
      if (currentToastIdRef.current !== null) {
        toast.dismiss(currentToastIdRef.current);
        currentToastIdRef.current = null;
      }

      if (!currentPendingUpdate) return;

      const isDirty = state.isDirty;
      const { acceptPendingUpdate, dismissPendingUpdate } = state;

      currentToastIdRef.current = toast.warning(
        isDirty
          ? "Workflow updated externally. Accepting will discard changes."
          : "Workflow updated externally.",
        {
          duration: Number.POSITIVE_INFINITY, // Keep until dismissed
          action: {
            label: isDirty ? "Update & Discard" : "Update",
            onClick: () => {
              startTransition(() => {
                acceptPendingUpdate();
              });
            },
          },
          cancel: {
            label: "Dismiss",
            onClick: () => {
              startTransition(() => {
                dismissPendingUpdate();
              });
            },
          },
        },
      );
    });

    return () => {
      unsubscribe();
      if (currentToastIdRef.current !== null) {
        toast.dismiss(currentToastIdRef.current);
      }
    };
  }, [store]);

  useEffect(() => {
    if (
      workflowName &&
      resourceUri &&
      projectKey &&
      !hasTrackedRecentRef.current
    ) {
      hasTrackedRecentRef.current = true;
      startTransition(() => {
        addRecent({
          id: resourceUri,
          name: workflowName,
          type: "workflow",
          icon: "flowchart",
          path: `/${projectKey}/rsc/i:workflows-management/workflow/${encodeURIComponent(
            resourceUri,
          )}`,
        });
      });
    }
  }, [workflowName, resourceUri, projectKey, addRecent]);

  return (
    <div className="h-full w-full flex flex-col">
      <DetailSection>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-3">
                <div>
                  <h1 className="text-2xl font-medium">{workflowName}</h1>
                  {workflowDescription && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {workflowDescription}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StartWorkflowButton />
          </div>
        </div>
      </DetailSection>

      <div className="flex-1 min-h-0 px-4 lg:px-6 xl:px-10 py-4 md:py-6 lg:py-8 bg-background border-b border-border">
        <div className="max-w-[1500px] mx-auto h-full flex flex-col">
          <h2 className="text-lg font-medium mb-4">Steps</h2>
          <div className="flex-1 min-h-0">
            <WorkflowStepsList />
          </div>
        </div>
      </div>
    </div>
  );
});

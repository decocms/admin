import type { WorkflowDefinition } from "@deco/sdk";
import type { StateCreator } from "zustand";
import type { Store } from "../store";

export interface SyncSlice {
  isDirty: boolean;
  lastServerVersion: WorkflowDefinition | null;
  pendingServerUpdate: WorkflowDefinition | null;
  lastModifiedStepName: string | null;
  handleExternalUpdate: (serverWorkflow: WorkflowDefinition) => {
    applied: boolean;
    reason: string;
    modifiedStepName?: string;
  };
  acceptPendingUpdate: () => void;
  dismissPendingUpdate: () => void;
  markClean: () => void;
}

export const createSyncSlice: StateCreator<Store, [], [], SyncSlice> = (
  set,
  get,
) => {
  const instanceId = Math.random().toString(36).slice(2, 8);

  return {
    isDirty: false,
    lastServerVersion: null,
    pendingServerUpdate: null,
    lastModifiedStepName: null,

    handleExternalUpdate: (serverWorkflow) => {
      const state = get();

      // Detect which step was modified (if only one)
      let modifiedStepName: string | undefined;
      if (
        state.workflow.steps.length === serverWorkflow.steps.length &&
        state.workflow.name === serverWorkflow.name &&
        state.workflow.description === serverWorkflow.description
      ) {
        // Same count, check which step differs
        const changedSteps = serverWorkflow.steps.filter((newStep, idx) => {
          const oldStep = state.workflow.steps[idx];
          return (
            oldStep &&
            oldStep.def.name === newStep.def.name &&
            JSON.stringify(oldStep) !== JSON.stringify(newStep)
          );
        });

        if (changedSteps.length === 1) {
          modifiedStepName = changedSteps[0].def.name;
        }
      }

      // Simple rule: auto-apply if not dirty, queue if dirty
      if (!state.isDirty) {
        set(
          {
            workflow: serverWorkflow,
            lastServerVersion: serverWorkflow,
            pendingServerUpdate: null,
            lastModifiedStepName: modifiedStepName || null,
          },
          false,
        );

        return {
          applied: true,
          reason: "Auto-applied: no local unsaved changes",
          modifiedStepName,
        };
      }

      // Store has unsaved changes, queue for user confirmation
      set(
        {
          pendingServerUpdate: serverWorkflow,
          lastServerVersion: serverWorkflow,
          lastModifiedStepName: null,
        },
        false,
      );

      return {
        applied: false,
        reason: "User has unsaved changes",
      };
    },

    acceptPendingUpdate: () => {
      const state = get();
      const { pendingServerUpdate } = state;
      if (!pendingServerUpdate) return;

      set({
        workflow: pendingServerUpdate,
        lastServerVersion: pendingServerUpdate,
        isDirty: false,
        pendingServerUpdate: null,
      });

      console.log(
        `[WF Store:#${instanceId}] acceptPendingUpdate → steps=${pendingServerUpdate.steps.length}`,
      );
    },

    dismissPendingUpdate: () => {
      set({ pendingServerUpdate: null });
      console.log(`[WF Store:#${instanceId}] dismissPendingUpdate`);
    },

    markClean: () => {
      set({
        isDirty: false,
        lastServerVersion: get().workflow,
      });
      console.log(`[WF Store:#${instanceId}] markClean`);
    },
  };
};

import type { WorkflowDefinition } from "@deco/sdk";
import type { StateCreator } from "zustand";
import type { Store } from "../store";

export interface SyncSlice {
  isDirty: boolean;
  lastServerVersion: WorkflowDefinition | null;
  pendingServerUpdate: WorkflowDefinition | null;
  handleExternalUpdate: (serverWorkflow: WorkflowDefinition) => {
    applied: boolean;
    reason: string;
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

    handleExternalUpdate: (serverWorkflow) => {
      const state = get();

      const onlyStepsLengthChanged =
        state.workflow.name === serverWorkflow.name &&
        state.workflow.description === serverWorkflow.description &&
        state.workflow.steps.length !== serverWorkflow.steps.length;

      console.log(
        `[WF Store:#${instanceId}] handleExternalUpdate → isDirty=${state.isDirty} currentSteps=${state.workflow.steps.length} serverSteps=${serverWorkflow.steps.length} onlyLengthChanged=${onlyStepsLengthChanged}`,
      );

      if (!state.isDirty && onlyStepsLengthChanged) {
        set(
          {
            workflow: serverWorkflow,
            lastServerVersion: serverWorkflow,
            pendingServerUpdate: null,
          },
          false,
        );

        console.log(
          `[WF Store:#${instanceId}] applied:auto → steps=${serverWorkflow.steps.length}`,
        );

        return {
          applied: true,
          reason: "Auto-updated: steps array length changed, no local edits",
        };
      }

      if (state.isDirty || !onlyStepsLengthChanged) {
        set(
          {
            pendingServerUpdate: serverWorkflow,
            lastServerVersion: serverWorkflow,
          },
          false,
        );

        console.log(
          `[WF Store:#${instanceId}] queued:pending → pending=${Boolean(serverWorkflow)}`,
        );

        return {
          applied: false,
          reason: state.isDirty
            ? "User has unsaved changes"
            : "Changes beyond steps array length",
        };
      }

      set(
        {
          workflow: serverWorkflow,
          lastServerVersion: serverWorkflow,
          pendingServerUpdate: null,
        },
        false,
      );

      console.log(
        `[WF Store:#${instanceId}] applied:default → steps=${serverWorkflow.steps.length}`,
      );

      return {
        applied: true,
        reason: "No conflicts detected",
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

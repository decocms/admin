import type { WorkflowDefinition } from "@deco/sdk";
import type { StateCreator } from "zustand";
import type { Store } from "../store";
import { toast } from "@deco/ui/components/sonner.tsx";

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
}

export const createSyncSlice: StateCreator<Store, [], [], SyncSlice> = (
  set,
  get,
) => {
  return {
    isDirty: false,
    lastServerVersion: null,
    pendingServerUpdate: null,

    handleExternalUpdate: (serverWorkflow) => {
      const state = get();

      // If not dirty: auto-update the UI with the entire workflow from server
      if (!state.isDirty) {
        set(
          {
            workflow: serverWorkflow,
            lastServerVersion: serverWorkflow,
            pendingServerUpdate: null,
          },
          false,
        );

        return {
          applied: true,
          reason: "Auto-applied: no local unsaved changes",
        };
      }

      // If dirty: queue for user confirmation before updating
      set(
        {
          pendingServerUpdate: serverWorkflow,
          lastServerVersion: serverWorkflow,
        },
        false,
      );

      toast.warning(
        "Workflow updated externally. Accepting will discard your changes.",
        {
          action: {
            label: "Accept & Discard",
            onClick: () => get().acceptPendingUpdate(),
          },
          cancel: {
            label: "Dismiss",
            onClick: () => get().dismissPendingUpdate(),
          },
        },
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

      // Update the entire workflow and steps from server
      set({
        workflow: pendingServerUpdate,
        lastServerVersion: pendingServerUpdate,
        isDirty: false,
        pendingServerUpdate: null,
      });
    },

    dismissPendingUpdate: () => {
      set({ pendingServerUpdate: null });
    },
  };
};

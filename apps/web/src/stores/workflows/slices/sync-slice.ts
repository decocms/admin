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

interface WorkflowChanges {
  hasViewsChanges: boolean;
  hasInputChanges: boolean;
  hasOtherChanges: boolean;
  stepsWithInputChanges: string[]; // Step names where input changed
  stepsWithViewsChanges: string[]; // Step names where views changed
}

/**
 * Compares two workflows and determines what kind of changes occurred
 */
function detectWorkflowChanges(
  current: WorkflowDefinition,
  incoming: WorkflowDefinition,
): WorkflowChanges {
  let hasViewsChanges = false;
  let hasInputChanges = false;
  let hasOtherChanges = false;
  const stepsWithInputChanges: string[] = [];
  const stepsWithViewsChanges: string[] = [];

  // Check workflow-level changes
  if (
    current.name !== incoming.name ||
    current.description !== incoming.description
  ) {
    hasOtherChanges = true;
  }

  // Check if step count changed
  if (current.steps.length !== incoming.steps.length) {
    hasOtherChanges = true;
  }

  // Compare each step
  for (
    let i = 0;
    i < Math.min(current.steps.length, incoming.steps.length);
    i++
  ) {
    const currentStep = current.steps[i];
    const incomingStep = incoming.steps[i];
    const stepName = currentStep.def.name;

    // Check views changes
    const currentViews = JSON.stringify(currentStep.views ?? []);
    const incomingViews = JSON.stringify(incomingStep.views ?? []);
    if (currentViews !== incomingViews) {
      hasViewsChanges = true;
      stepsWithViewsChanges.push(stepName);
    }

    // Check input changes
    const currentInput = JSON.stringify(currentStep.input ?? {});
    const incomingInput = JSON.stringify(incomingStep.input ?? {});
    if (currentInput !== incomingInput) {
      hasInputChanges = true;
      stepsWithInputChanges.push(stepName);
    }

    // Check def changes (name, description, schema, execute, dependencies)
    const currentDef = JSON.stringify({
      name: currentStep.def.name,
      title: currentStep.def.title,
      description: currentStep.def.description,
      inputSchema: currentStep.def.inputSchema,
      outputSchema: currentStep.def.outputSchema,
      execute: currentStep.def.execute,
      dependencies: currentStep.def.dependencies,
    });
    const incomingDef = JSON.stringify({
      name: incomingStep.def.name,
      title: incomingStep.def.title,
      description: incomingStep.def.description,
      inputSchema: incomingStep.def.inputSchema,
      outputSchema: incomingStep.def.outputSchema,
      execute: incomingStep.def.execute,
      dependencies: incomingStep.def.dependencies,
    });
    if (currentDef !== incomingDef) {
      hasOtherChanges = true;
    }

    // Check output changes
    const currentOutput = JSON.stringify(currentStep.output ?? {});
    const incomingOutput = JSON.stringify(incomingStep.output ?? {});
    if (currentOutput !== incomingOutput) {
      hasOtherChanges = true;
    }
  }

  return {
    hasViewsChanges,
    hasInputChanges,
    hasOtherChanges,
    stepsWithInputChanges,
    stepsWithViewsChanges,
  };
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
      const currentWorkflow = state.workflow;

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

      // Detect what changed between current and server workflows
      const changes = detectWorkflowChanges(currentWorkflow, serverWorkflow);

      // Auto-apply if only views changed
      if (
        changes.hasViewsChanges &&
        !changes.hasInputChanges &&
        !changes.hasOtherChanges
      ) {
        set(
          {
            workflow: serverWorkflow,
            lastServerVersion: serverWorkflow,
            pendingServerUpdate: null,
            // Keep isDirty state as-is since we're only updating views
          },
          false,
        );

        toast.info("Step views updated from server", {
          description: "View configurations have been synchronized",
        });

        return {
          applied: true,
          reason: "Auto-applied: only views changed",
        };
      }

      // If input changed (with or without other changes), require confirmation
      if (changes.hasInputChanges) {
        set(
          {
            pendingServerUpdate: serverWorkflow,
            lastServerVersion: serverWorkflow,
          },
          false,
        );

        toast.warning(
          "Workflow inputs updated externally. Accepting will override your current workflow.",
          {
            description: changes.hasOtherChanges
              ? "Other workflow changes are also included"
              : "Step inputs have been modified",
            action: {
              label: "Accept & Override",
              onClick: () => get().acceptPendingUpdate(),
            },
            cancel: {
              label: "Keep Mine",
              onClick: () => get().dismissPendingUpdate(),
            },
          },
        );

        return {
          applied: false,
          reason: "Input changes require user confirmation",
        };
      }

      // If other changes (def, output, structure), require confirmation
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
            label: "Keep Mine",
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
      const { pendingServerUpdate, stepInputs } = state;
      if (!pendingServerUpdate) return;

      // Detect if inputs changed to determine which stepInputs to clear
      const changes = detectWorkflowChanges(
        state.workflow,
        pendingServerUpdate,
      );

      // Only clear stepInputs for steps where input actually changed
      const updatedStepInputs = { ...stepInputs };
      if (changes.hasInputChanges) {
        for (const stepName of changes.stepsWithInputChanges) {
          delete updatedStepInputs[stepName];
        }
      }

      // Override the entire workflow with server version
      // Clear only the specific stepInputs that changed
      set({
        workflow: pendingServerUpdate,
        lastServerVersion: pendingServerUpdate,
        isDirty: false,
        pendingServerUpdate: null,
        stepInputs: updatedStepInputs,
      });

      toast.success("Workflow updated", {
        description: changes.hasInputChanges
          ? `Applied changes and reset ${changes.stepsWithInputChanges.length} step input(s)`
          : "Applied external changes successfully",
      });
    },

    dismissPendingUpdate: () => {
      set({ pendingServerUpdate: null });

      toast.info("Keeping local version", {
        description: "External changes were dismissed",
      });
    },
  };
};

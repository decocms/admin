import type { WorkflowStep } from "@deco/sdk";
import type { StateCreator } from "zustand";
import type { Store } from "../store";

export interface StepManagementSlice {
  addStep: (step: WorkflowStep) => void;
  updateStep: (stepName: string, updates: Partial<WorkflowStep>) => void;
  removeStep: (stepName: string) => void;
}

export const createStepManagementSlice: StateCreator<
  Store,
  [],
  [],
  StepManagementSlice
> = (set) => {
  const instanceId = Math.random().toString(36).slice(2, 8);

  return {
    addStep: (step) => {
      set((state) => ({
        workflow: {
          ...state.workflow,
          steps: [...state.workflow.steps, step],
        },
        isDirty: true,
      }));
    },

    updateStep: (stepName, updates) => {
      set((state) => ({
        workflow: {
          ...state.workflow,
          steps: state.workflow.steps.map((s) => {
            if (s.def.name !== stepName) return s;

            // If def is being updated, deep-merge it and protect the name
            const newDef = updates.def
              ? {
                  ...s.def,
                  ...updates.def,
                  // Always preserve the original name unless explicitly renamed
                  // This prevents accidental orphaning
                  name: updates.def.name || s.def.name,
                }
              : s.def;

            // Build the updated step
            const updatedStep: WorkflowStep = {
              ...s,
              ...updates,
              def: newDef,
            };

            // If name actually changed, clear broken input references
            if (newDef.name !== stepName) {
              console.warn(
                `[WF Store:#${instanceId}] Step renamed: ${stepName} → ${newDef.name}. Clearing input to avoid broken references.`,
              );
              updatedStep.input = undefined;
            }

            return updatedStep;
          }),
        },
        isDirty: true,
      }));
    },

    removeStep: (stepName) => {
      set((state) => ({
        workflow: {
          ...state.workflow,
          steps: state.workflow.steps.filter((s) => s.def.name !== stepName),
        },
        isDirty: true,
      }));
    },
  };
};

import type { WorkflowStep } from "@deco/sdk";
import type { StateCreator } from "zustand";
import type { Store } from "../store";

export interface StepManagementSlice {
  addStep: (step: WorkflowStep) => void;
  updateStep: (stepName: string, updates: Partial<WorkflowStep>) => void;
  removeStep: (stepName: string) => void;
  reorderSteps: (fromIndex: number, toIndex: number) => void;
}

export const createStepManagementSlice: StateCreator<
  Store,
  [],
  [],
  StepManagementSlice
> = (set, get) => {
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
      const s = get();
      console.log(
        `[WF Store:#${instanceId}] addStep → steps=${s.workflow.steps.length}`,
      );
    },

    updateStep: (stepName, updates) => {
      set((state) => ({
        workflow: {
          ...state.workflow,
          steps: state.workflow.steps.map((s) =>
            s.def.name === stepName ? { ...s, ...updates } : s,
          ),
        },
        isDirty: true,
      }));
      console.log(`[WF Store:#${instanceId}] updateStep(${stepName})`);
    },

    removeStep: (stepName) => {
      set((state) => ({
        workflow: {
          ...state.workflow,
          steps: state.workflow.steps.filter((s) => s.def.name !== stepName),
        },
        isDirty: true,
      }));
      const s = get();
      console.log(
        `[WF Store:#${instanceId}] removeStep(${stepName}) → steps=${s.workflow.steps.length}`,
      );
    },

    reorderSteps: (fromIndex, toIndex) => {
      set((state) => {
        const newSteps = [...state.workflow.steps];
        const [movedStep] = newSteps.splice(fromIndex, 1);
        newSteps.splice(toIndex, 0, movedStep);

        return {
          workflow: {
            ...state.workflow,
            steps: newSteps,
          },
          isDirty: true,
        };
      });
      console.log(
        `[WF Store:#${instanceId}] reorderSteps(${fromIndex}→${toIndex})`,
      );
    },
  };
};

import { WorkflowDefinition } from "@deco/sdk";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface State {
  workflow: WorkflowDefinition;
  stepOutputs: Record<string, unknown>;
  stepInputs: Record<string, unknown>;
}

export interface Actions {
  setStepOutput: (stepName: string, output: unknown) => void;
  setStepInput: (stepName: string, input: unknown) => void;
}

export interface Store extends State {
  actions: Actions;
}

export const createWorkflowStore = (
  initialState: Omit<State, "currentRunUri">,
) => {
  // Create a unique storage key based on the workflow name
  const storageKey = `workflow-store-${initialState.workflow.name}`;

  return create<Store>()(
    persist(
      (set) => ({
        ...initialState,
        stepOutputs: initialState.stepOutputs || {},
        stepInputs: initialState.stepInputs || {},
        actions: {
          setStepOutput: (stepName, output) =>
            set((state) => ({
              stepOutputs: { ...state.stepOutputs, [stepName]: output },
            })),
          setStepInput: (stepName, input) =>
            set((state) => ({
              stepInputs: { ...state.stepInputs, [stepName]: input },
            })),
        },
      }),
      {
        name: storageKey,
        partialize: (state) => ({
          stepOutputs: state.stepOutputs,
          stepInputs: state.stepInputs,
        }),
      },
    ),
  );
};

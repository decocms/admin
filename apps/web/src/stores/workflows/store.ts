import { WorkflowDefinition } from "@deco/sdk";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface State {
  workflowUri: string;
  currentRunUri: string | null;
  workflow: WorkflowDefinition;
  stepOutputs: Record<string, unknown>;
}

export interface Actions {
  setCurrentRunUri: (uri: string | null) => void;
  setStepOutput: (stepName: string, output: unknown) => void;
}

export interface Store extends State {
  actions: Actions;
}

export const createWorkflowStore = (
  initialState: Omit<State, "currentRunUri">,
) => {
  // Create a unique storage key based on the workflow URI
  const storageKey = `workflow-store-${initialState.workflowUri}`;

  return create<Store>()(
    persist(
      (set) => ({
        ...initialState,
        currentRunUri: null,
        stepOutputs: {},
        actions: {
          setCurrentRunUri: (uri) => set({ currentRunUri: uri }),
          setStepOutput: (stepName, output) =>
            set((state) => ({
              stepOutputs: { ...state.stepOutputs, [stepName]: output },
            })),
        },
      }),
      {
        name: storageKey,
        partialize: (state) => ({
          currentRunUri: state.currentRunUri,
        }),
      },
    ),
  );
};

import type { WorkflowDefinition } from "@deco/sdk";
import type { StateCreator } from "zustand";
import type { Store } from "../store";

export interface WorkflowSlice {
  workflow: WorkflowDefinition;
  updateWorkflow: (workflow: WorkflowDefinition) => void;
}

export const createWorkflowSlice: StateCreator<Store, [], [], WorkflowSlice> = (
  set,
) => ({
  workflow: {} as WorkflowDefinition,

  updateWorkflow: (workflow) =>
    set(() => ({
      workflow,
      isDirty: true,
    })),
});

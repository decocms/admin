import { createStore } from "zustand/vanilla";
import {
  createWorkflowSlice,
  type WorkflowSlice,
} from "./slices/workflow-slice";
import { createSyncSlice, type SyncSlice } from "./slices/sync-slice";
import {
  createStepExecutionSlice,
  type StepExecutionSlice,
} from "./slices/step-execution-slice";
import {
  createStepManagementSlice,
  type StepManagementSlice,
} from "./slices/step-management-slice";
import { createUISlice, type UISlice } from "./slices/ui-slice";
import { createJSONStorage, persist } from "zustand/middleware";

// Re-export types needed by slices
export interface StepExecution {
  start?: string;
  end?: string;
  error?: { name?: string; message?: string } | null;
  success?: boolean;
}

// Combine all slice types into the main Store type
export type Store = WorkflowSlice &
  SyncSlice &
  StepExecutionSlice &
  StepManagementSlice &
  UISlice;

// Keep State and Actions types for backward compatibility
export type State = Pick<
  Store,
  | "workflow"
  | "workflowUri"
  | "isDirty"
  | "lastServerVersion"
  | "pendingServerUpdate"
  | "stepOutputs"
  | "stepInputs"
  | "stepExecutions"
>;

export type Actions = Pick<
  Store,
  | "handleExternalUpdate"
  | "acceptPendingUpdate"
  | "dismissPendingUpdate"
  | "resetAndResync"
  | "addStep"
  | "updateStep"
  | "removeStep"
  | "updateWorkflow"
  | "setStepOutput"
  | "setStepInput"
  | "setStepExecutionStart"
  | "setStepExecutionEnd"
  | "runStep"
  | "openExecuteEditor"
  | "closeExecuteEditor"
  | "toggleExecuteEditor"
  | "setExecuteDraft"
  | "clearExecuteDraft"
  | "hasExecuteDraft"
>;

export const createWorkflowStore = (
  initialState: Pick<State, "workflow" | "workflowUri">,
) => {
  return createStore<Store>()(
    persist(
      (set, get, api) => ({
        // Initialize workflow slice
        ...createWorkflowSlice(set, get, api),
        workflow: initialState.workflow,
        workflowUri: initialState.workflowUri,

        // Initialize sync slice with server version
        ...createSyncSlice(set, get, api),
        lastServerVersion: initialState.workflow,

        // Initialize step execution slice
        ...createStepExecutionSlice(set, get, api),

        // Initialize step management slice
        ...createStepManagementSlice(set, get, api),

        // Initialize UI slice
        ...createUISlice(set, get, api),
      }),
      {
        name: `workflow-store-${encodeURIComponent(initialState.workflowUri).slice(0, 200)}`,
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          stepInputs: state.stepInputs,
          stepOutputs: state.stepOutputs,
          stepExecutions: state.stepExecutions,
        }),
      },
    ),
  );
};

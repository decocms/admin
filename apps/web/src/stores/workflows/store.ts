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
  StepManagementSlice;

// Keep State and Actions types for backward compatibility
export type State = Pick<
  Store,
  | "workflow"
  | "isDirty"
  | "lastServerVersion"
  | "pendingServerUpdate"
  | "lastModifiedStepName"
  | "stepOutputs"
  | "stepInputs"
  | "stepExecutions"
>;

export type Actions = Pick<
  Store,
  | "handleExternalUpdate"
  | "acceptPendingUpdate"
  | "dismissPendingUpdate"
  | "addStep"
  | "updateStep"
  | "removeStep"
  | "updateWorkflow"
  | "setStepOutput"
  | "setStepInput"
  | "setStepExecutionStart"
  | "setStepExecutionEnd"
>;

export const createWorkflowStore = (initialState: Pick<State, "workflow">) => {
  return createStore<Store>()((set, get, api) => ({
    // Initialize workflow slice
    ...createWorkflowSlice(set, get, api),
    workflow: initialState.workflow,

    // Initialize sync slice with server version
    ...createSyncSlice(set, get, api),
    lastServerVersion: initialState.workflow,

    // Initialize step execution slice
    ...createStepExecutionSlice(set, get, api),

    // Initialize step management slice
    ...createStepManagementSlice(set, get, api),
  }));
};

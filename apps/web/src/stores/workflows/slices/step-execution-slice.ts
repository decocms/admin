import type { StateCreator } from "zustand";
import type { Store, StepExecution } from "../store";

export interface StepExecutionSlice {
  stepOutputs: Record<string, unknown>;
  stepInputs: Record<string, unknown>;
  stepExecutions: Record<string, StepExecution>;
  setStepOutput: (stepName: string, output: unknown) => void;
  setStepInput: (stepName: string, input: unknown) => void;
  setStepExecutionStart: (stepName: string) => void;
  setStepExecutionEnd: (
    stepName: string,
    success: boolean,
    error?: { name?: string; message?: string },
  ) => void;
}

export const createStepExecutionSlice: StateCreator<
  Store,
  [],
  [],
  StepExecutionSlice
> = (set) => ({
  stepOutputs: {},
  stepInputs: {},
  stepExecutions: {},

  setStepOutput: (stepName, output) =>
    set((state) => ({
      stepOutputs: { ...state.stepOutputs, [stepName]: output },
    })),

  setStepInput: (stepName, input) =>
    set((state) => ({
      stepInputs: { ...state.stepInputs, [stepName]: input },
      isDirty: true,
    })),

  setStepExecutionStart: (stepName) =>
    set((state) => ({
      stepExecutions: {
        ...state.stepExecutions,
        [stepName]: {
          start: new Date().toISOString(),
          end: undefined,
          error: null,
          success: undefined,
        },
      },
    })),

  setStepExecutionEnd: (stepName, success, error) =>
    set((state) => {
      const prev = state.stepExecutions[stepName] || {};
      return {
        stepExecutions: {
          ...state.stepExecutions,
          [stepName]: {
            ...prev,
            end: new Date().toISOString(),
            success,
            error: error || null,
          },
        },
      };
    }),
});

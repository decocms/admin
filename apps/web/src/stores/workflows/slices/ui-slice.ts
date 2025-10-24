import type { StateCreator } from "zustand";
import type { Store } from "../store";

export interface UISlice {
  // Track which step's execute code is being viewed/edited
  executeEditorStepName: string | null;

  // Draft state for execute code editing
  executeDrafts: Record<string, string>;

  // Actions
  openExecuteEditor: (stepName: string) => void;
  closeExecuteEditor: () => void;
  toggleExecuteEditor: (stepName: string) => void;
  setExecuteDraft: (stepName: string, code: string) => void;
  clearExecuteDraft: (stepName: string) => void;
  hasExecuteDraft: (stepName: string) => boolean;
}

export const createUISlice: StateCreator<Store, [], [], UISlice> = (
  set,
  get,
) => ({
  executeEditorStepName: null,
  executeDrafts: {},

  openExecuteEditor: (stepName) =>
    set(() => ({
      executeEditorStepName: stepName,
    })),

  closeExecuteEditor: () =>
    set(() => ({
      executeEditorStepName: null,
    })),

  toggleExecuteEditor: (stepName) =>
    set(() => {
      const current = get().executeEditorStepName;
      return {
        executeEditorStepName: current === stepName ? null : stepName,
      };
    }),

  setExecuteDraft: (stepName, code) =>
    set((state) => ({
      executeDrafts: {
        ...state.executeDrafts,
        [stepName]: code,
      },
    })),

  clearExecuteDraft: (stepName) =>
    set((state) => {
      const { [stepName]: _, ...rest } = state.executeDrafts;
      return { executeDrafts: rest };
    }),

  hasExecuteDraft: (stepName) => stepName in get().executeDrafts,
});

import type { StateCreator } from "zustand";
import type { Store } from "../store";

export interface UISlice {
  // Track which step's execute code is being viewed/edited
  executeEditorStepName: string | null;

  // Actions
  openExecuteEditor: (stepName: string) => void;
  closeExecuteEditor: () => void;
  toggleExecuteEditor: (stepName: string) => void;
}

export const createUISlice: StateCreator<Store, [], [], UISlice> = (
  set,
  get,
) => ({
  executeEditorStepName: null,

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
});

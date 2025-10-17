import { WorkflowDefinition } from "@deco/sdk";
import { create } from "zustand";

export interface State {
  uri: string;
  workflow: WorkflowDefinition;
}

export interface Actions {
  setUri: (uri: string) => void;
}

export interface Store extends State {
  actions: Actions;
}

export const createWorkflowStore = (initialState: State) => {
  return create<Store>((set) => ({
    ...initialState,
    actions: {
      setUri: (uri) => set({ ...initialState, uri }),
    },
  }));
};

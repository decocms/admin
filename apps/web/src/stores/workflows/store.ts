import { WorkflowDefinition } from "@deco/sdk";
import { create } from "zustand";
import { persist } from "zustand/middleware";

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
  // Create a unique storage key based on the workflow URI
  const storageKey = `workflow-store-${initialState.uri}`;

  return create<Store>()(
    persist(
      (set) => ({
        ...initialState,
        actions: {
          setUri: (uri) => set({ uri }),
        },
      }),
      {
        name: storageKey,
        partialize: (state) => ({
          uri: state.uri,
        }),
      },
    ),
  );
};

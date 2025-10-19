import { useStore } from "zustand";
import type { StoreApi } from "zustand";
import { createWorkflowStore, type Store } from "./store";
import { createContext, useContext, useMemo, useState } from "react";
import type { WorkflowDefinition } from "@deco/sdk";

export const WorkflowStoreContext = createContext<StoreApi<Store> | null>(null);

export function WorkflowStoreProvider({
  children,
  workflow,
}: {
  children: React.ReactNode;
  workflow: WorkflowDefinition;
}) {
  console.log(
    "[WorkflowStoreProvider] 🎬 Component mounted/rendered, workflow:",
    workflow.name,
  );

  const [store] = useState(() => {
    const s = createWorkflowStore({ workflow }, "WorkflowStoreProvider");
    console.log(
      "[WorkflowStoreProvider] 🏪 Created store for workflow:",
      workflow.name,
    );
    return s;
  });

  const debug = useMemo(() => {
    const s = store.getState();
    return {
      steps: s.workflow.steps.length,
      name: s.workflow.name,
      isDirty: s.isDirty,
    };
  }, [store]);
  console.log(
    `[WF Provider] render → name=${debug.name} steps=${debug.steps} dirty=${debug.isDirty}`,
  );

  return (
    <WorkflowStoreContext.Provider value={store}>
      {children}
    </WorkflowStoreContext.Provider>
  );
}

export function useWorkflowStore<T>(selector: (state: Store) => T): T {
  const store = useContext(WorkflowStoreContext);
  if (!store) {
    throw new Error(
      "Missing WorkflowStoreProvider - refresh the page. If the error persists, please contact support.",
    );
  }
  return useStore(store, selector);
}

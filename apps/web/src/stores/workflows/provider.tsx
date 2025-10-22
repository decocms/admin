import { useStoreWithEqualityFn } from "zustand/traditional";
import type { StoreApi } from "zustand";
import { createWorkflowStore, type Store } from "./store";
import { createContext, useContext, useState } from "react";
import type { WorkflowDefinition } from "@deco/sdk";
import { shallow } from "zustand/vanilla/shallow";

export const WorkflowStoreContext = createContext<StoreApi<Store> | null>(null);

export function WorkflowStoreProvider({
  children,
  workflow,
  workflowUri,
}: {
  children: React.ReactNode;
  workflow: WorkflowDefinition;
  workflowUri: string;
}) {
  const [store] = useState(() =>
    createWorkflowStore({ workflow, workflowUri }),
  );

  return (
    <WorkflowStoreContext.Provider value={store}>
      {children}
    </WorkflowStoreContext.Provider>
  );
}

export function useWorkflowStore<T>(
  selector: (state: Store) => T,
  equalityFn?: (a: T, b: T) => boolean,
): T {
  const store = useContext(WorkflowStoreContext);
  if (!store) {
    throw new Error(
      "Missing WorkflowStoreProvider - refresh the page. If the error persists, please contact support.",
    );
  }
  return useStoreWithEqualityFn(store, selector, equalityFn ?? shallow);
}

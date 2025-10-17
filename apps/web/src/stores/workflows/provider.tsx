import { StoreApi } from "zustand";
import { createWorkflowStore, State, Store } from "./store";
import { createContext, useContext, useState } from "react";

const WorkflowStoreContext = createContext<StoreApi<Store> | null>(null);

export const WorkflowStoreProvider = ({
  children,
  initialState,
}: {
  children: React.ReactNode;
  initialState: State;
}) => {
  const [store] = useState(() => createWorkflowStore(initialState));
  return (
    <WorkflowStoreContext.Provider value={store}>
      {children}
    </WorkflowStoreContext.Provider>
  );
};

export const useWorkflowStore = () => {
  const store = useContext(WorkflowStoreContext);
  if (!store) {
    throw new Error("Missing WorkflowStoreProvider");
  }
  return store;
};

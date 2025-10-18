import { create } from "zustand";

interface State {
  currentRunUri: string | null;
}

export interface Actions {
  setCurrentRunUri: (uri: string | null) => void;
}

export interface Store extends State {
  actions: Actions;
}

const createRunStore = create<Store>((set) => ({
  currentRunUri: null,
  actions: {
    setCurrentRunUri: (uri) => set({ currentRunUri: uri }),
  },
}));

export const useCurrentRunUri = () => {
  return createRunStore((state) => state.currentRunUri);
};

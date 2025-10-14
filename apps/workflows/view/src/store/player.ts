import { create } from "zustand";

interface State {
  isPlaying: boolean;
}

interface Actions {
  setIsPlaying: (isPlaying: boolean) => void;
}

interface Store extends State {
  actions: Actions;
}

const useWorkflowPlayerStore = create<Store>((set) => ({
  isPlaying: false,
  actions: {
    setIsPlaying: (isPlaying) => {
      set({ isPlaying });
      console.log("🎵 [Store] Player state:", isPlaying ? "Playing" : "Paused");
    },
  },
}));

export const useWorkflowPlayerActions = () => {
  const store = useWorkflowPlayerStore();
  return store.actions;
};

export const useIsWorkflowPlayerPlaying = () => {
  const store = useWorkflowPlayerStore();
  return store.isPlaying;
};

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface State {
  view: "workflows" | "tools";
}
interface Actions {
  setView: (view: "workflows" | "tools") => void;
}
interface Store extends State {
  actions: Actions;
}

const sidebarStore = create<Store>()(
  persist(
    (set) => ({
      view: "workflows",
      actions: {
        setView: (view) => {
          set({ view });
        },
      },
    }),
    {
      name: "sidebar-store",
      partialize: (state) => ({
        view: state.view,
      }),
    },
  ),
);

export const useSidebarActiveView = () => {
  return sidebarStore((state) => state.view);
};

export const useSidebarActions = () => {
  return sidebarStore((state) => state.actions);
};

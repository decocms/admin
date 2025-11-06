import { useLocalStorage } from "../../hooks/use-local-storage";

export function useDecopilotOpen() {
  const [open, setOpen] = useLocalStorage(
    "deco-cms-decopilot",
    (existing) => existing ?? true,
  );

  const toggle = () => {
    setOpen(!open);
  };

  return {
    open,
    setOpen,
    toggle,
  };
}

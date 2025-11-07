import { useLocalStorage } from "../../hooks/use-local-storage";

export function useDecopilotOpen() {
  const [open, setOpen] = useLocalStorage<boolean>(
    "deco-cms-decopilot",
    (existing) => Boolean(existing ?? true),
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

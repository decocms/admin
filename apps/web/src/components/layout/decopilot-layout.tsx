import { useLocalStorage } from "../../hooks/use-local-storage";

export function useDecopilotOpen() {
  const { value: open, update: setOpen } = useLocalStorage({
    key: "deco-cms-decopilot",
    defaultValue: true,
  });

  const toggle = () => {
    setOpen(!open);
  };

  return {
    open,
    setOpen,
    toggle,
  };
}

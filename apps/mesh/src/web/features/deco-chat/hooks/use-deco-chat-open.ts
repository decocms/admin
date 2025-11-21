import { useCallback } from "react";
import { useLocalStorage } from "@/web/hooks/use-local-storage";

export function useDecoChatOpen() {
  const [open, setOpenStorage] = useLocalStorage<boolean>(
    "mesh:decochat:open",
    (existing) => Boolean(existing ?? false),
  );

  const setOpen = useCallback(
    (next: boolean) => {
      setOpenStorage(next);
    },
    [setOpenStorage],
  );

  const toggle = useCallback(() => {
    setOpenStorage(!open);
  }, [open, setOpenStorage]);

  return {
    open,
    setOpen,
    toggle,
  };
}

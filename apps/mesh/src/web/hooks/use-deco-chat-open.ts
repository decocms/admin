import { useCallback } from "react";
import { useLocalStorage } from "@/web/hooks/use-local-storage";
import { LOCALSTORAGE_KEYS } from "@/web/lib/localstorage-keys";

export function useDecoChatOpen() {
  const [open, setOpenStorage] = useLocalStorage<boolean>(
    LOCALSTORAGE_KEYS.decoChatOpen(),
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

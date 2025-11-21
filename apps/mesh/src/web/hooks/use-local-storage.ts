import { useCallback, useEffect, useState } from "react";

function getInitialValue<T>(
  key: string,
  initializer: T | ((existing: T | undefined) => T),
) {
  if (typeof window === "undefined") {
    return typeof initializer === "function"
      ? (initializer as (existing: T | undefined) => T)(undefined)
      : initializer;
  }

  const stored = window.localStorage.getItem(key);
  const existing = stored ? (JSON.parse(stored) as T) : undefined;

  const next =
    typeof initializer === "function"
      ? (initializer as (current: T | undefined) => T)(existing)
      : (existing ?? initializer);

  if (existing === undefined || next !== existing) {
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // ignore write errors during initialization
    }
  }

  return next;
}

export function useLocalStorage<T>(
  key: string,
  initializer: T | ((existing: T | undefined) => T),
) {
  const [value, setValue] = useState<T>(() =>
    getInitialValue(key, initializer),
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handler = (event: StorageEvent) => {
      if (event.key !== key) return;
      try {
        const parsed = event.newValue
          ? (JSON.parse(event.newValue) as T)
          : null;
        if (parsed !== null) {
          setValue(parsed);
        }
      } catch {
        // ignore parse errors
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [key]);

  const updateValue = useCallback(
    (next: T) => {
      setValue(next);
      if (typeof window === "undefined") return;
      window.localStorage.setItem(key, JSON.stringify(next));
    },
    [key],
  );

  return [value, updateValue] as const;
}

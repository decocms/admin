import { useEffect, useState } from "react";

const STORAGE_EVENT = "deco-chat::storage-change";

interface UseLocalStorageSetterProps {
  key: string;
}

function useLocalStorageSetter({ key }: UseLocalStorageSetterProps) {
  function update(value: unknown) {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
    globalThis.dispatchEvent(
      new CustomEvent(STORAGE_EVENT, {
        detail: { key, value: value === null ? null : JSON.stringify(value) },
      }),
    );
  }
  return { update };
}

function useLocalStorageChange(
  key: string,
  callback: (value: string | null) => void,
) {
  useEffect(() => {
    function handleStorageChange(
      event: CustomEvent<{ key: string; value: string | null }>,
    ) {
      if (event.detail.key === key) {
        callback(event.detail.value);
      }
    }
    globalThis.addEventListener(
      STORAGE_EVENT,
      handleStorageChange as EventListener,
    );
    return () => {
      globalThis.removeEventListener(
        STORAGE_EVENT,
        handleStorageChange as EventListener,
      );
    };
  }, [key]);
}

interface UseLocalStorageProps<T> {
  key: string;
  defaultValue: T;
  migrate?: (value: T) => T;
}

function useLocalStorage<T>({
  key,
  defaultValue,
  migrate,
}: UseLocalStorageProps<T>) {
  const [value, setValue] = useState<T>(() => {
    const item = localStorage.getItem(key);
    if (!item) return defaultValue;
    try {
      const parsed = JSON.parse(item) as T;
      const next = migrate ? migrate(parsed) : parsed;
      if (migrate && next !== parsed) {
        try {
          localStorage.setItem(key, JSON.stringify(next));
          globalThis.dispatchEvent(
            new CustomEvent(STORAGE_EVENT, {
              detail: { key, value: JSON.stringify(next) },
            }),
          );
        } catch {
          console.warn("Failed to write to localStorage", key);
        }
      }
      return next;
    } catch {
      return defaultValue;
    }
  });

  useLocalStorageChange(key, (value) => {
    setValue(value ? JSON.parse(value) : defaultValue);
  });

  const { update } = useLocalStorageSetter({ key });

  return {
    value,
    update,
  };
}

export { useLocalStorage, useLocalStorageChange, useLocalStorageSetter };

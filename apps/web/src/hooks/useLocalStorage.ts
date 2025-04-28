import { useEffect, useState } from "react";

const STORAGE_EVENT = "deco-chat::storage-change";

interface UseLocalStorageSetterProps<T> {
  key: string;
  serializer?: (value: T) => string;
  onUpdate?: (value: T) => void;
}

export function useLocalStorageSetter<T>({
  key,
  serializer = JSON.stringify,
  onUpdate,
}: UseLocalStorageSetterProps<T>) {
  const update = (value: T) => {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, serializer(value));
    }

    // Dispatch custom event to notify other hooks
    globalThis.dispatchEvent(
      new CustomEvent(STORAGE_EVENT, {
        detail: { key, value },
      }),
    );
    onUpdate?.(value);
  };

  const patch = (value: Partial<T>) => {
    const currentValue = JSON.parse(localStorage.getItem(key) || "{}") as T;
    const updatedValue = { ...currentValue, ...value };
    update(updatedValue);
  };

  return { update, patch };
}

export function useLocalStorageChange(
  key: string,
  callback: (value: string | null) => void,
) {
  useEffect(() => {
    const handleStorageChange = (
      event: CustomEvent<{ key: string; value: string | null }>,
    ) => {
      if (event.detail.key === key) {
        callback(event.detail.value);
      }
    };

    // Listen for our custom storage events
    globalThis.addEventListener(
      STORAGE_EVENT,
      handleStorageChange as EventListener,
    );

    // Also listen for actual storage events from other tabs/globalThiss
    const handleActualStorage = (e: StorageEvent) => {
      if (e.key === key) {
        callback(e.newValue);
      }
    };
    globalThis.addEventListener("storage", handleActualStorage);

    return () => {
      globalThis.removeEventListener(
        STORAGE_EVENT,
        handleStorageChange as EventListener,
      );
      globalThis.removeEventListener("storage", handleActualStorage);
    };
  }, [key]);
}

interface UseLocalStorageProps<T> extends UseLocalStorageSetterProps<T> {
  defaultValue: T;
  deserializer?: (value: string) => T;
}

export function useLocalStorage<T>({
  key,
  defaultValue,
  serializer = JSON.stringify,
  deserializer = JSON.parse,
  onUpdate,
}: UseLocalStorageProps<T>) {
  const [value, setValue] = useState<T>(() => {
    const item = localStorage.getItem(key);
    return item ? deserializer(item) : defaultValue;
  });

  useLocalStorageChange(key, (value) => {
    setValue(value ? deserializer(value) : defaultValue);
  });

  const { update, patch } = useLocalStorageSetter({
    key,
    serializer,
    onUpdate,
  });

  return {
    value,
    update,
    patch,
  };
}

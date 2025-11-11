import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useEffect } from "react";

function safeParse<T>(value: string): T | undefined {
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

/**
 * Initialize value from localStorage using the initializer
 * Handles reading, applying initializer, and saving back if needed
 */
function initializeFromStorage<T>(
  key: string,
  initializer: T | ((existing: T | undefined) => T),
): T {
  const item = localStorage.getItem(key);
  const existing = item ? safeParse<T>(item) : undefined;

  // Call initializer (value or function)
  const next =
    typeof initializer === "function"
      ? (initializer as (existing: T | undefined) => T)(existing)
      : (existing ?? initializer);

  // If the initializer changed the value (migration or default), save it back
  if (existing === undefined || next !== existing) {
    try {
      const stringified = JSON.stringify(next);
      localStorage.setItem(key, stringified);
    } catch {
      // Ignore errors during migration or initial save
    }
  }

  return next;
}

function useLocalStorage<T>(
  key: string,
  initializer: T | ((existing: T | undefined) => T),
): [T, (value: T | ((prev: T) => T)) => void] {
  const queryClientInstance = useQueryClient();
  const queryKey = ["localStorage", key] as const;
  const queryClientRef = useRef(queryClientInstance);
  const queryKeyRef = useRef(queryKey);

  // Keep refs up to date
  useEffect(() => {
    queryClientRef.current = queryClientInstance;
    queryKeyRef.current = queryKey;
  }, [queryClientInstance, queryKey]);

  // Use TanStack Query to read from localStorage
  const { data: value } = useQuery({
    queryKey,
    queryFn: () => initializeFromStorage(key, initializer),
    initialData: () => initializeFromStorage(key, initializer),
    staleTime: Infinity, // localStorage doesn't change unless we update it
    gcTime: Infinity, // Keep in cache indefinitely
  });

  // Mutation to write to localStorage
  const mutation = useMutation({
    mutationFn: async (newValue: T) => {
      const stringified = JSON.stringify(newValue);
      localStorage.setItem(key, stringified);
      return newValue;
    },
    onSuccess: (newValue) => {
      // Update the query cache optimistically
      queryClientRef.current.setQueryData(queryKeyRef.current, newValue);
    },
  });

  const mutateRef = useRef(mutation.mutate);
  useEffect(() => {
    mutateRef.current = mutation.mutate;
  }, [mutation.mutate]);

  // Setter that updates localStorage via mutation
  const setLocalStorageValue = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      const currentValue = queryClientRef.current.getQueryData<T>(queryKeyRef.current);
      const nextValue =
        typeof newValue === "function"
          ? (newValue as (prev: T) => T)(currentValue as T)
          : newValue;
      mutateRef.current(nextValue);
    },
    [],
  );

  // Return the value from query (guaranteed to be T due to initialData)
  return [value as T, setLocalStorageValue];
}

export { useLocalStorage };

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

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

export function useLocalStorage<T>(
  key: string,
  initializer: T | ((existing: T | undefined) => T),
): [T, (value: T) => void] {
  const queryClientInstance = useQueryClient();
  const queryKey = ["localStorage", key] as const;

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
      queryClientInstance.setQueryData(queryKey, newValue);
    },
  });

  // Setter that updates localStorage via mutation
  const setLocalStorageValue = useCallback(
    (newValue: T) => mutation.mutate(newValue),
    [mutation],
  );

  // Return the value from query (guaranteed to be T due to initialData)
  return [value as T, setLocalStorageValue];
}

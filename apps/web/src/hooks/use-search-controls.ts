import { useCallback, useState } from "react";

export interface SearchControls {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSearchBlur: () => void;
  onSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

/**
 * Generic hook for managing search UI state and handlers
 * Provides stable function references to prevent unnecessary re-renders
 */
export function useSearchControls(): SearchControls {
  const [searchValue, setSearchValue] = useState("");

  const onSearchChange = useCallback((value: string) => {
    setSearchValue(value);
  }, []);

  const onSearchBlur = useCallback(() => {
    // Don't clear on blur - keep the search value
  }, []);

  const onSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        setSearchValue("");
        // Blur the input to remove focus
        (e.target as HTMLInputElement).blur();
      }
    },
    [],
  );

  return {
    searchValue,
    onSearchChange,
    onSearchBlur,
    onSearchKeyDown,
  };
}

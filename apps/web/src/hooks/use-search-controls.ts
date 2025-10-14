import { useCallback, useState } from "react";

export interface SearchControls {
  searchOpen: boolean;
  searchValue: string;
  onSearchToggle: () => void;
  onSearchChange: (value: string) => void;
  onSearchBlur: () => void;
  onSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

/**
 * Generic hook for managing search UI state and handlers
 * Provides stable function references to prevent unnecessary re-renders
 */
export function useSearchControls(): SearchControls {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const onSearchToggle = useCallback(() => {
    setSearchOpen((prev) => !prev);
  }, []);

  const onSearchChange = useCallback((value: string) => {
    setSearchValue(value);
  }, []);

  const onSearchBlur = useCallback(() => {
    if (!searchValue) {
      setSearchOpen(false);
    }
  }, [searchValue]);

  const onSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        setSearchValue("");
        setSearchOpen(false);
        // Blur the input to remove focus
        (e.target as HTMLInputElement).blur();
      }
    },
    [],
  );

  return {
    searchOpen,
    searchValue,
    onSearchToggle,
    onSearchChange,
    onSearchBlur,
    onSearchKeyDown,
  };
}

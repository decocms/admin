import { useEffect, useRef, useState } from "react";
import { useIsMobile } from "./use-mobile.ts";

type ViewMode = "cards" | "table";

export function useViewMode(
  key?: string,
): [ViewMode, (mode: ViewMode) => void] {
  const isMobile = useIsMobile();
  const previousIsMobile = useRef<boolean>(isMobile);
  const storageKey = key ? `deco-view-mode-${key}` : "deco-view-mode";

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    // Handle SSR - default to cards when window is not available
    if (typeof globalThis !== "undefined") {
      // First check localStorage for user preference
      const stored = globalThis.localStorage?.getItem(storageKey);
      if (stored === "cards" || stored === "table") {
        return stored as ViewMode;
      }
      // Fall back to screen size based default
      if (globalThis.innerWidth) {
        return globalThis.innerWidth < 768 ? "cards" : "table";
      }
    }
    return "cards";
  });

  // Wrapper function to save to localStorage when user manually changes view
  const setViewModeWithStorage = (mode: ViewMode) => {
    setViewMode(mode);
    if (typeof globalThis !== "undefined" && globalThis.localStorage) {
      globalThis.localStorage.setItem(storageKey, mode);
    }
  };

  // Only auto-switch when transitioning from desktop to mobile (not when already mobile)
  useEffect(() => {
    // If we just transitioned from desktop to mobile AND currently on table view
    if (!previousIsMobile.current && isMobile && viewMode === "table") {
      setViewMode("cards"); // Don't save auto-switches to localStorage
    }
    // Update the previous value for next render
    previousIsMobile.current = isMobile;
  }, [isMobile, viewMode]);

  return [viewMode, setViewModeWithStorage];
}

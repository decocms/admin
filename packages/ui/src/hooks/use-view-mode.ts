import { useEffect, useState, useRef } from "react";
import { useIsMobile } from "./use-mobile.ts";

type ViewMode = "cards" | "table";

export function useViewMode(): [ViewMode, (mode: ViewMode) => void] {
  const isMobile = useIsMobile();
  const previousIsMobile = useRef<boolean>(isMobile);
  
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    // Handle SSR - default to cards when window is not available
    if (typeof globalThis !== "undefined" && globalThis.innerWidth) {
      return globalThis.innerWidth < 768 ? "cards" : "table";
    }
    return "cards";
  });

  // Only auto-switch when transitioning from desktop to mobile (not when already mobile)
  useEffect(() => {
    // If we just transitioned from desktop to mobile AND currently on table view
    if (!previousIsMobile.current && isMobile && viewMode === "table") {
      setViewMode("cards");
    }
    // Update the previous value for next render
    previousIsMobile.current = isMobile;
  }, [isMobile, viewMode]);

  return [viewMode, setViewMode];
} 
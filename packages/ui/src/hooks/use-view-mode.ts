import { useEffect, useState } from "react";
import { useIsMobile } from "./use-mobile.ts";

type ViewMode = "cards" | "table";

export function useViewMode(): [ViewMode, (mode: ViewMode) => void] {
  const isMobile = useIsMobile();
  
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    // Handle SSR - default to cards when window is not available
    if (typeof globalThis !== "undefined" && globalThis.innerWidth) {
      return globalThis.innerWidth < 768 ? "cards" : "table";
    }
    return "cards";
  });

  // Automatically switch to cards on mobile if currently on table view
  useEffect(() => {
    if (isMobile && viewMode === "table") {
      setViewMode("cards");
    }
  }, [isMobile, viewMode]);

  return [viewMode, setViewMode];
} 
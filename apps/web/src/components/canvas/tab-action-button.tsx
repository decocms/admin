import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

const PORTAL_TARGET_ID = "canvas-tab-actions-portal";

interface TabActionButtonProps {
  children: ReactNode;
}

/**
 * TabActionButton renders its children into the canvas tab header's action slot
 * using React Portals. This allows detail views to render their action buttons
 * in the canvas header without prop drilling.
 *
 * Usage:
 * ```tsx
 * <TabActionButton>
 *   <Button>My Action</Button>
 * </TabActionButton>
 * ```
 */
export function TabActionButton({ children }: TabActionButtonProps) {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Find the portal target element
    const target = document.getElementById(PORTAL_TARGET_ID);
    setPortalTarget(target);

    if (!target) {
      console.warn(
        `TabActionButton: Portal target with id "${PORTAL_TARGET_ID}" not found`,
      );
    }
  }, []);

  // If portal target is not available, don't render anything
  if (!portalTarget) {
    return null;
  }

  return createPortal(children, portalTarget);
}

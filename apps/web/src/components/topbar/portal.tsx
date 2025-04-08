import { useMemo } from "react";
import { createPortal } from "react-dom";
import { TOPBAR_ACTION_ID, TOPBAR_BREADCRUMB_ID } from "../../constants.ts";

interface TopbarPortalProps {
  children: React.ReactNode;
}

export function TopbarAction({ children }: TopbarPortalProps) {
  const container = useMemo(
    () => document.getElementById(TOPBAR_ACTION_ID),
    [],
  );

  if (!container) {
    return null;
  }

  return createPortal(children, container);
}

export function TopbarBreadcrumb({ children }: TopbarPortalProps) {
  const container = useMemo(
    () => document.getElementById(TOPBAR_BREADCRUMB_ID),
    [],
  );

  if (!container) {
    return null;
  }

  return createPortal(children, container);
}

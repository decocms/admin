import { createPortal } from "react-dom";
import { type ReactNode, type ReactPortal, useEffect } from "react";

/**
 * Same thing as React.createPortal, but prepends
 * the container instead of appending it.
 */
export const createPrependPortal = (
  component: ReactNode,
  container: Element,
): ReactPortal => {
  const portalContainer = document.createElement("div");

  useEffect(() => {
    // @ts-expect-error - Works fine
    container.prepend(portalContainer);
    return () => {
      container.removeChild(portalContainer);
    };
  }, [container, portalContainer]);

  return createPortal(
    component,
    portalContainer,
  );
};

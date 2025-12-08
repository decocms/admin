import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT = 768;

const isMobileDevice = () => globalThis.innerWidth < MOBILE_BREAKPOINT;

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(isMobileDevice);

  // oxlint-disable-next-line ban-use-effect/ban-use-effect
  useEffect(() => {
    const onChange = () => setIsMobile(isMobileDevice);
    const mql = globalThis.matchMedia(
      `(max-width: ${MOBILE_BREAKPOINT - 1}px)`,
    );
    mql.addEventListener("change", onChange);
    setIsMobile(isMobileDevice);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}

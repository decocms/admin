import { useEffect, useState } from "react";
import decoLight from "../../assets/deco-light.svg?url";
import decoDark from "../../assets/deco-dark.svg?url";

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
}

export function Logo({ className = "", width = 68, height = 28 }: LogoProps) {
  const [isDark, setIsDark] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);

    const checkTheme = () => {
      const _html = document.documentElement;
      const savedTheme = localStorage.getItem("theme") || "auto";

      let isDarkTheme = false;

      if (savedTheme === "auto") {
        // Use system preference
        isDarkTheme = globalThis.matchMedia(
          "(prefers-color-scheme: dark)",
        ).matches;
      } else {
        isDarkTheme = savedTheme === "dark";
      }

      setIsDark(isDarkTheme);
    };

    // Check initial theme
    checkTheme();

    // Watch for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "data-theme"
        ) {
          checkTheme();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    // Listen for system theme changes
    const mediaQuery = globalThis.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", checkTheme);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener("change", checkTheme);
    };
  }, []);

  // Show light logo by default during SSR
  if (!isClient) {
    return (
      <div className={`relative ${className}`}>
        <img src={decoLight} alt="Deco" width={width} height={height} />
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <img
        src={isDark ? decoDark : decoLight}
        alt="Deco"
        width={width}
        height={height}
      />
    </div>
  );
}

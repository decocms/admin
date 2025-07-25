import { useState, useEffect } from "react";
import decoLight from "../../assets/deco-light.svg?url";
import decoDark from "../../assets/deco-dark.svg?url";

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
}

export function Logo({ className = "", width = 68, height = 28 }: LogoProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkTheme = () => {
      const theme = document.documentElement.getAttribute("data-theme");
      setIsDark(theme === "dark");
    };

    // Check initial theme
    checkTheme();

    // Watch for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes" && mutation.attributeName === "data-theme") {
          checkTheme();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => observer.disconnect();
  }, []);

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

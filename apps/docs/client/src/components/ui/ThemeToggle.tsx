import React, { useEffect, useState } from "react";
import { Button } from "../atoms/Button";
import { Icon } from "../atoms/Icon";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | "auto">("auto");

  useEffect(() => {
    // Get saved theme from localStorage or default to auto
    const savedTheme =
      (localStorage.getItem("theme") as "light" | "dark" | "auto") || "auto";
    setTheme(savedTheme);
    // Don't apply theme here since the script in the head already does it
  }, []);

  const applyTheme = (newTheme: "light" | "dark" | "auto") => {
    const html = document.documentElement;

    if (newTheme === "auto") {
      // Use system preference
      const prefersDark = globalThis.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      html.setAttribute("data-theme", prefersDark ? "dark" : "light");
    } else {
      html.setAttribute("data-theme", newTheme);
    }

    localStorage.setItem("theme", newTheme);
  };

  const cycleTheme = () => {
    const nextTheme =
      theme === "light" ? "dark" : theme === "dark" ? "auto" : "light";
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  const getThemeIcon = () => {
    switch (theme) {
      case "light":
        return "Sun";
      case "dark":
        return "Moon";
      case "auto":
        return "Monitor";
      default:
        return "Monitor";
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      className="h-8 w-8"
    >
      <Icon name={getThemeIcon()} size={16} />
    </Button>
  );
}

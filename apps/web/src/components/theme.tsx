/**
 * Very ugly code but the animation looks good.
 * Take the time to refactor this someday.
 */
import { type ThemeVariable, useSDK, useOrgTheme } from "@deco/sdk";
import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";

/**
 * Kind of a stale cache for the theme so we don't show the splash screen
 * every time the user opens a workspace.
 */
const THEME_CACHE_KEY = (locator: string) => `workspace_theme_cache_${locator}`;

export const clearThemeCache = (locator: string) => {
  localStorage.removeItem(THEME_CACHE_KEY(locator));
};

export const useTheme = () => {
  const { locator } = useSDK();
  const { data: theme, isLoading: isQueryLoading } = useOrgTheme();

  const [cachedTheme, setCachedTheme] = useState(() => {
    const cached = localStorage.getItem(THEME_CACHE_KEY(locator));
    return cached ? JSON.parse(cached) : null;
  });

  useEffect(() => {
    if (theme) {
      localStorage.setItem(THEME_CACHE_KEY(locator), JSON.stringify(theme));
      setCachedTheme(theme);
    }
  }, [theme, locator]);

  // Listen for manual theme updates
  useEffect(() => {
    const handleThemeUpdate = () => {
      clearThemeCache(locator);
      setCachedTheme(null);
    };

    window.addEventListener("theme-updated", handleThemeUpdate);
    return () => {
      window.removeEventListener("theme-updated", handleThemeUpdate);
    };
  }, [locator]);

  return {
    data: cachedTheme || theme,
    isLoading: isQueryLoading && !cachedTheme,
    isStale:
      !!cachedTheme &&
      !!theme &&
      JSON.stringify(cachedTheme) !== JSON.stringify(theme),
  };
};

export function WithWorkspaceTheme({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: theme } = useTheme();
  const loadedLogo = theme?.picture ?? "/img/deco-logo.svg";
  const loadedBackground =
    theme?.variables?.["--sidebar" as ThemeVariable] ??
    theme?.variables?.["--background" as ThemeVariable] ??
    null;
  const splashRef = useRef<HTMLDivElement>(null);
  const circleRef = useRef<HTMLDivElement>(null);
  const splashScreenRef = useRef<HTMLDivElement>(null);
  const loadedColorCircleRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLImageElement>(null);
  const loadedBackgroundPromise = useRef<PromiseWithResolvers<void>>(
    Promise.withResolvers(),
  );
  const forceCloseSplashPromise = useRef<PromiseWithResolvers<void>>(
    Promise.withResolvers(),
  );
  const { locator } = useSDK();
  const [showSplash, setShowSplash] = useState(() => {
    return !localStorage.getItem(THEME_CACHE_KEY(locator));
  });

  useEffect(() => {
    if (!showSplash) return;

    if (splashRef.current && circleRef.current) {
      // Initial animation for the logo
      gsap.fromTo(
        splashRef.current,
        { scale: 0.5, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.5, ease: "power2.out" },
      );

      // Expand the background circle
      gsap
        .fromTo(
          circleRef.current,
          { scale: 0, opacity: 0 },
          {
            scale: 20, // Large enough to cover the screen
            opacity: 1,
            duration: 1.5,
            ease: "power2.inOut",
            delay: 0.2,
          },
        )
        .then(() => {
          loadedBackgroundPromise.current.resolve();
        });
    }
  }, [showSplash]);

  useEffect(() => {
    if (!showSplash) return;

    if (loadedLogo && logoRef.current) {
      // Create a new image element to preload the workspace logo
      const newLogo = new Image();
      newLogo.src = loadedLogo;

      newLogo.onload = () => {
        // Fade out current logo
        loadedBackgroundPromise.current.promise.then(() => {
          gsap.to(logoRef.current, {
            opacity: 0,
            duration: 0.5,
            ease: "power2.inOut",
            onComplete: () => {
              // Update the src and fade in
              if (logoRef.current) {
                logoRef.current.src = loadedLogo;
                gsap.to(logoRef.current, {
                  opacity: 1,
                  duration: 0.5,
                  ease: "power2.inOut",
                });
              }
            },
          });
        });
      };
    }
  }, [loadedLogo, showSplash]);

  const animateCloseSplash = () => {
    if (splashScreenRef.current) {
      gsap.to(splashScreenRef.current, {
        scale: 0,
        opacity: 1,
        duration: 1,
        ease: "power2.inOut",
        onComplete: () => {
          setShowSplash(false);
        },
      });
    }
  };

  useEffect(() => {
    if (!showSplash) return;

    if (loadedBackground) {
      loadedBackgroundPromise.current.promise.then(() => {
        if (loadedColorCircleRef.current) {
          gsap
            .fromTo(
              loadedColorCircleRef.current,
              { scale: 0, opacity: 0 },
              {
                scale: 20,
                opacity: 1,
                duration: 1.5,
                ease: "power2.inOut",
                delay: 0.2,
              },
            )
            .then(() => {
              animateCloseSplash();
            });
        }
      });
    }
  }, [loadedBackground, showSplash]);

  // No matter what, we want to close the splash screen after max 4.5 seconds
  useEffect(() => {
    if (!showSplash) return;

    const timeoutId = setTimeout(() => {
      forceCloseSplashPromise.current.resolve();
    }, 4_500);

    forceCloseSplashPromise.current.promise.then(() => {
      animateCloseSplash();
    });

    return () => {
      clearTimeout(timeoutId);
    };
  }, [showSplash]);

  // Use the object from the query directly so the reference is stable
  const variables = theme?.variables;

  // Apply theme variables to document root so portal content can access them
  // Track previously applied keys to remove stale variables
  const appliedKeysRef = useRef<Set<string>>(new Set());

  // Only re-apply when the theme actually changes to avoid fighting with the editor's live updates
  // useMemo creates a stable reference that only changes when the actual values change
  const variablesSnapshot = useMemo(
    () => (variables ? JSON.stringify(variables) : "{}"),
    [variables],
  );

  useEffect(() => {
    if (!variables) return;

    const root = document.documentElement;
    const newKeys = new Set<string>();

    // Apply new/updated variables
    Object.entries(variables).forEach(([key, value]) => {
      if (value) {
        root.style.setProperty(key, value as string);
        newKeys.add(key);
      }
    });

    // Remove properties that are no longer in the theme
    appliedKeysRef.current.forEach((key) => {
      if (!newKeys.has(key)) {
        root.style.removeProperty(key);
      }
    });

    appliedKeysRef.current = newKeys;
  }, [variablesSnapshot]); // Only re-run when the stringified version changes

  return (
    <>
      {showSplash && (
        <div
          ref={splashScreenRef}
          className="fixed inset-0 flex items-center justify-center z-50 bg-background"
        >
          <div
            ref={circleRef}
            // deno-lint-ignore ensure-tailwind-design-system-tokens/ensure-tailwind-design-system-tokens
            className="absolute w-24 h-24 rounded-full bg-stone-200"
            style={{ transformOrigin: "center" }}
          />
          {loadedBackground && (
            <div
              ref={loadedColorCircleRef}
              className="absolute w-24 h-24 rounded-full opacity-0"
              style={{
                transformOrigin: "center",
                backgroundColor: loadedBackground,
              }}
            />
          )}
          <div
            ref={splashRef}
            className="relative flex flex-col items-center justify-center"
          >
            <div className="p-4 rounded-full bg-white">
              <img
                ref={logoRef}
                src="/img/deco-logo.svg"
                alt="Deco Logo"
                className="w-36 h-36 object-contain rounded-full"
              />
            </div>
          </div>
        </div>
      )}
      <div className="h-full w-full">{children}</div>
    </>
  );
}

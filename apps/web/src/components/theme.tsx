import { CSSProperties } from "react";
import { useSDK } from "@deco/sdk";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

const THEME_VARIABLES = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--destructive",
  "--destructive-foreground",
  "--border",
  "--input",
  "--sidebar",
  "--primary-light",
  "--primary-dark",
  "--splash",
] as const;

type ThemeVariable = typeof THEME_VARIABLES[number];

interface GoogleFontsThemeFont {
  type: "Google Fonts";
  name: string;
}

interface CustomUploadedThemeFont {
  type: "Custom";
  name: string;
  url: string;
}

interface Theme {
  variables?: Partial<Record<ThemeVariable, string>>;
  picture?: string;
  font?: GoogleFontsThemeFont | CustomUploadedThemeFont;
}

const DEFAULT_THEME: Theme = {
  variables: {
    "--background": "oklch(1 0 0)",
    "--foreground": "oklch(26.8% 0.007 34.298)",
    "--primary-light": "#d0ec1a",
    "--primary-dark": "#07401a",
    "--card": "oklch(1 0 0)",
    "--card-foreground": "oklch(26.8% 0.007 34.298)",
    "--popover": "oklch(1 0 0)",
    "--popover-foreground": "oklch(26.8% 0.007 34.298)",
    "--primary": "oklch(26.8% 0.007 34.298)",
    "--primary-foreground": "oklch(98.5% 0.001 106.423)",
    "--secondary": "oklch(97% 0.001 106.424)",
    "--secondary-foreground": "oklch(26.8% 0.007 34.298)",
    "--muted": "oklch(97% 0.001 106.424)",
    "--muted-foreground": "oklch(55.3% 0.013 58.071)",
    "--accent": "oklch(97% 0.001 106.424)",
    "--accent-foreground": "oklch(26.8% 0.007 34.298)",
    "--destructive": "oklch(0.577 0.245 27.325)",
    "--destructive-foreground": "oklch(1 0 0)",
    "--border": "oklch(92.3% 0.003 48.717)",
    "--input": "oklch(92.3% 0.003 48.717)",
    "--sidebar": "oklch(98.5% 0.001 106.423)",
  },
  font: {
    type: "Google Fonts",
    name: "Inter",
  },
//   picture: "/img/deco-chat-logo.png",
};

const TIMBRO_THEME: Theme = {
    picture: "https://client.timbrotrading.com/build/images/timbro-logo-02.png",
    variables: {
        "--primary": "#d6074c",
        "--splash": "#d6074c",
        "--primary-light": "#dd3b71",
        "--primary-dark": "#ffffff",
        "--sidebar": "#f9cddc",
        "--muted": "#f49cb9",
        "--accent": "#f49cb9",
        "--muted-foreground": "#737373",
        "--accent-foreground": "#737373",
        "--border": "#444444",
        "--input": "#444444",
    },
};

const getWorkspaceTheme = (_workspace: string): Promise<Theme | null> =>
  Promise.resolve(_workspace.includes("timbro") ? TIMBRO_THEME : DEFAULT_THEME);

const useWorkspaceTheme = (workspace: string) => {
  return useQuery({
    queryKey: ["theme", workspace],
    queryFn: async () => {
      const workspaceTheme = await getWorkspaceTheme(workspace);
      return {
        ...DEFAULT_THEME,
        ...(workspaceTheme ?? {}),
      };
    },
  });
};

export const useTheme = () => {
  const { workspace } = useSDK();
  const theme = useWorkspaceTheme(workspace);

  return theme;
};

export function WithWorkspaceTheme({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: theme, isLoading: isQueryLoading } = useTheme();
  const loadedLogo = theme?.picture ?? "/img/deco-chat-logo.png";
  const loadedBackground = theme?.variables?.[
    "--splash" as ThemeVariable
  ] ?? theme?.variables?.[
    "--sidebar" as ThemeVariable
  ] ?? null;
  const splashRef = useRef<HTMLDivElement>(null);
  const circleRef = useRef<HTMLDivElement>(null);
  const splashScreenRef = useRef<HTMLDivElement>(null);
  const loadedColorCircleRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLImageElement>(null);
  const loadedBackgroundPromise = useRef<PromiseWithResolvers<void>>(
    Promise.withResolvers(),
  );

  useEffect(() => {
    if (splashRef.current && circleRef.current) {
      // Initial animation for the logo
      gsap.fromTo(
        splashRef.current,
        { scale: 0.5, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.5, ease: "power2.out" },
      );

      // Expand the background circle
      gsap.fromTo(
        circleRef.current,
        { scale: 0, opacity: 0 },
        {
          scale: 20, // Large enough to cover the screen
          opacity: 1,
          duration: 1.5,
          ease: "power2.inOut",
          delay: 0.2,
        },
      ).then(() => {
        loadedBackgroundPromise.current.resolve();
      });
    }
  }, []);

  useEffect(() => {
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
                    ease: "power2.inOut"
                });
                }
            }
            });
        })
      };
    }
  }, [loadedLogo]);

  useEffect(() => {
    if (loadedBackground) {
      loadedBackgroundPromise.current.promise.then(() => {
        if (loadedColorCircleRef.current) {
          gsap.fromTo(
            loadedColorCircleRef.current,
            { scale: 0, opacity: 0 },
            {
              scale: 20,
              opacity: 1,
              duration: 1.5,
              ease: "power2.inOut",
              delay: 0.2,
            },
          ).then(() => {
            if (splashScreenRef.current) {
              gsap.to(splashScreenRef.current, {
                y: -(splashScreenRef.current.clientHeight * 2),
                duration: 2,
                ease: "power2.inOut",
              });
            }
          });
        }
      });
    }
  }, [loadedBackground]);

  const variables = {
    ...theme?.variables,
    "--font-sans": `"${theme?.font?.name}", sans-serif`,
  };
  console.log(variables);

  return (
    <>
      <div
        ref={splashScreenRef}
        className="fixed inset-0 flex items-center justify-center z-50 bg-white"
      >
        <div
          ref={circleRef}
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
              src="/img/deco-chat-logo.png"
              alt="Deco Chat Logo"
              className="w-36 h-36 object-contain rounded-full"
            />
          </div>
        </div>
      </div>
      <div className="h-full w-full" style={variables as CSSProperties}>
        {children}
      </div>
    </>
  );
}

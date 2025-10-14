/**
 * TODO(camudo): Handle custom fonts
 */

export const THEME_VARIABLES = [
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
  "--success",
  "--success-foreground",
  "--warning",
  "--warning-foreground",
  "--border",
  "--input",
  "--sidebar",
  "--sidebar-foreground",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
  "--sidebar-border",
  "--sidebar-ring",
  "--primary-light",
  "--primary-dark",
  "--splash",
] as const;
export type ThemeVariable = (typeof THEME_VARIABLES)[number];
export interface GoogleFontsThemeFont {
  type: "Google Fonts";
  name: string;
}

export interface CustomUploadedThemeFont {
  type: "Custom";
  name: string;
  url: string;
}

export interface Theme {
  variables?: Partial<Record<ThemeVariable, string>>;
  picture?: string;
  font?: GoogleFontsThemeFont | CustomUploadedThemeFont;
}

export const DEFAULT_THEME: Theme = {
  variables: {
    "--background": "oklch(1 0 0)",
    "--foreground": "oklch(20.5% 0 0)",
    "--primary-light": "#d0ec1a",
    "--primary-dark": "#07401a",
    "--card": "oklch(97.6% 0 0)",
    "--card-foreground": "oklch(20.5% 0 0)",
    "--popover": "oklch(1 0 0)",
    "--popover-foreground": "oklch(20.5% 0 0)",
    "--primary": "oklch(20.5% 0 0)",
    "--primary-foreground": "oklch(98.5% 0 0)",
    "--secondary": "oklch(97% 0 0)",
    "--secondary-foreground": "oklch(20.5% 0 0)",
    "--muted": "oklch(97% 0 0)",
    "--muted-foreground": "oklch(55.6% 0 0)",
    "--accent": "oklch(97% 0 0)",
    "--accent-foreground": "oklch(20.5% 0 0)",
    "--destructive": "oklch(0.577 0.245 27.325)",
    "--destructive-foreground": "oklch(1 0 0)",
    "--success": "oklch(0.654 0.184 142.0)",
    "--success-foreground": "oklch(0.963 0.025 137.0)",
    "--warning": "oklch(0.877 0.184 99.0)",
    "--warning-foreground": "oklch(0.293 0.071 70.0)",
    "--border": "oklch(92.2% 0 0)",
    "--input": "oklch(92.2% 0 0)",
    "--sidebar": "oklch(1 0 0)",
    "--sidebar-foreground": "oklch(20.5% 0 0)",
    "--sidebar-accent": "oklch(97% 0 0)",
    "--sidebar-accent-foreground": "oklch(20.5% 0 0)",
    "--sidebar-border": "oklch(92.2% 0 0)",
    "--sidebar-ring": "oklch(92.2% 0 0)",
  },

  font: {
    type: "Google Fonts",
    name: "Inter",
  },
};

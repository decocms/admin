/**
 * TODO(camudo): Handle custom fonts
 */

export const COLOR_VARIABLES = [
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
  "--ring",
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
  "--sidebar",
  "--sidebar-foreground",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
  "--sidebar-border",
] as const;

export const LAYOUT_VARIABLES = ["--radius", "--spacing"] as const;

export const SHADOW_VARIABLES = [
  "--shadow-x",
  "--shadow-y",
  "--shadow-blur",
  "--shadow-spread",
  "--shadow-opacity",
] as const;

export const THEME_VARIABLES = [
  ...COLOR_VARIABLES,
  ...LAYOUT_VARIABLES,
  ...SHADOW_VARIABLES,
] as const;

export type ColorVariable = (typeof COLOR_VARIABLES)[number];
export type LayoutVariable = (typeof LAYOUT_VARIABLES)[number];
export type ShadowVariable = (typeof SHADOW_VARIABLES)[number];
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
    "--foreground": "oklch(0.2050 0 0)",
    "--card": "oklch(0.9760 0 0)",
    "--card-foreground": "oklch(0.2050 0 0)",
    "--popover": "oklch(1 0 0)",
    "--popover-foreground": "oklch(0.2050 0 0)",
    "--primary": "oklch(0.8916 0.2037 118.17)",
    "--primary-foreground": "oklch(0.3266 0.0858 149.2)",
    "--secondary": "oklch(0.9700 0 0)",
    "--secondary-foreground": "oklch(0.2050 0 0)",
    "--muted": "oklch(0.9700 0 0)",
    "--muted-foreground": "oklch(0.5560 0 0)",
    "--accent": "oklch(0.9700 0 0)",
    "--accent-foreground": "oklch(0.2050 0 0)",
    "--destructive": "oklch(0.5770 0.2450 27.3250)",
    "--destructive-foreground": "oklch(1 0 0)",
    "--success": "oklch(0.6540 0.1840 142)",
    "--success-foreground": "oklch(0.263 0.71 137)",
    "--warning": "oklch(0.8770 0.1840 99)",
    "--warning-foreground": "oklch(0.2930 0.0710 70)",
    "--border": "oklch(0.850 0 0)",
    "--input": "oklch(0.9220 0 0)",
    "--ring": "oklch(0.2680 0.0070 34.2980)",
    "--chart-1": "oklch(0.8916 0.2037 118.17)",
    "--chart-2": "oklch(0.7278 0.150971 289.0085)",
    "--chart-3": "oklch(0.8444 0.1699 84.54)",
    "--chart-4": "oklch(0.7372 0.168276 159.446)",
    "--chart-5": "oklch(0.6078 0.2017 6.81)",
    "--sidebar": "oklch(1 0 0)",
    "--sidebar-foreground": "oklch(0.2050 0 0)",
    "--sidebar-accent": "oklch(0.9700 0 0)",
    "--sidebar-accent-foreground": "oklch(0.2050 0 0)",
    "--sidebar-border": "oklch(0.850 0 0)",
    "--radius": "0.375rem",
    "--spacing": "0.25rem",
    "--shadow-x": "0",
    "--shadow-y": "1px",
    "--shadow-blur": "3px",
    "--shadow-spread": "0px",
    "--shadow-opacity": "0.1",
  },

  font: {
    type: "Google Fonts",
    name: "Inter",
  },
};

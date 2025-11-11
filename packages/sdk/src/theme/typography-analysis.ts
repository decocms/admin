import type { GoogleFontsThemeFont } from "../theme.ts";

// Popular Google Fonts that we support
export const GOOGLE_FONTS = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Raleway",
  "Ubuntu",
  "Nunito",
  "Playfair Display",
  "Merriweather",
  "PT Sans",
  "Source Sans Pro",
  "Work Sans",
  "Karla",
  "DM Sans",
  "Outfit",
  "Manrope",
  "Space Grotesk",
  "Plus Jakarta Sans",
  "Lexend",
  "Rubik",
  "IBM Plex Sans",
  "Noto Sans",
  "Cabin",
  "Quicksand",
  "Josefin Sans",
  "Archivo",
  "Mulish",
  "Barlow",
] as const;

export interface FontInfo {
  family: string;
  frequency: number;
  importance: number; // 0-1, based on element type and position
  elementTypes: string[];
}

/**
 * Common font aliases and their Google Font equivalents
 */
const FONT_ALIASES: Record<string, string> = {
  "system-ui": "Inter",
  "-apple-system": "Inter",
  "BlinkMacSystemFont": "Inter",
  "Segoe UI": "Inter",
  "Helvetica Neue": "Inter",
  "Helvetica": "Inter",
  "Arial": "Inter",
  "sans-serif": "Inter",
  "Georgia": "Merriweather",
  "Times New Roman": "Playfair Display",
  "Times": "Playfair Display",
  "serif": "Merriweather",
  "Courier New": "IBM Plex Mono",
  "Courier": "IBM Plex Mono",
  "monospace": "IBM Plex Mono",
};

/**
 * Clean font family string (remove quotes, fallbacks, etc)
 */
export function cleanFontFamily(fontFamily: string): string[] {
  return fontFamily
    .split(",")
    .map((f) =>
      f
        .trim()
        .replace(/["']/g, "")
        .trim()
    )
    .filter(Boolean);
}

/**
 * Check if a font is a Google Font
 */
export function isGoogleFont(fontName: string): boolean {
  return GOOGLE_FONTS.some(
    (gf) => gf.toLowerCase() === fontName.toLowerCase(),
  );
}

/**
 * Find the closest Google Font match for a given font
 */
export function findGoogleFontMatch(fontFamily: string): string | null {
  const fonts = cleanFontFamily(fontFamily);

  for (const font of fonts) {
    // Check if it's already a Google Font
    if (isGoogleFont(font)) {
      const match = GOOGLE_FONTS.find(
        (gf) => gf.toLowerCase() === font.toLowerCase(),
      );
      return match || null;
    }

    // Check aliases
    const alias = FONT_ALIASES[font];
    if (alias) {
      return alias;
    }

    // Try partial matching (e.g., "Roboto Condensed" -> "Roboto")
    const partialMatch = GOOGLE_FONTS.find((gf) =>
      font.toLowerCase().includes(gf.toLowerCase()) ||
      gf.toLowerCase().includes(font.toLowerCase())
    );
    if (partialMatch) {
      return partialMatch;
    }
  }

  return null;
}

/**
 * Analyze fonts from DOM computed styles
 */
export function analyzeFontsFromStyles(
  stylesData: Array<{
    element: string;
    styles: Record<string, string>;
    importance: number;
  }>,
): FontInfo[] {
  const fontMap = new Map<string, FontInfo>();

  for (const { element, styles, importance } of stylesData) {
    const fontFamily = styles.fontFamily;
    if (!fontFamily) continue;

    const fonts = cleanFontFamily(fontFamily);
    
    // Only process the first declared font (most specific)
    const primaryFont = fonts[0];
    if (!primaryFont) continue;

    const existing = fontMap.get(primaryFont.toLowerCase());

    if (existing) {
      existing.frequency++;
      existing.importance = Math.max(existing.importance, importance);
      if (!existing.elementTypes.includes(element)) {
        existing.elementTypes.push(element);
      }
    } else {
      fontMap.set(primaryFont.toLowerCase(), {
        family: primaryFont,
        frequency: 1,
        importance,
        elementTypes: [element],
      });
    }
  }

  return Array.from(fontMap.values()).sort((a, b) => {
    const scoreA = a.frequency * a.importance;
    const scoreB = b.frequency * b.importance;
    return scoreB - scoreA;
  });
}

/**
 * Extract the best font match from analyzed fonts
 */
export function extractBestFont(fonts: FontInfo[]): GoogleFontsThemeFont | null {
  // Try to find a Google Font in order of importance
  for (const font of fonts) {
    const match = findGoogleFontMatch(font.family);
    if (match) {
      return {
        type: "Google Fonts",
        name: match,
      };
    }
  }

  // If no match found, return a sensible default based on the most used font characteristics
  const mostUsed = fonts[0];
  if (mostUsed) {
    const lowerFamily = mostUsed.family.toLowerCase();
    
    // Check for serif fonts
    if (
      lowerFamily.includes("serif") ||
      lowerFamily.includes("times") ||
      lowerFamily.includes("georgia")
    ) {
      return { type: "Google Fonts", name: "Merriweather" };
    }

    // Check for display/decorative fonts
    if (
      lowerFamily.includes("display") ||
      lowerFamily.includes("playfair")
    ) {
      return { type: "Google Fonts", name: "Playfair Display" };
    }

    // Check for monospace
    if (
      lowerFamily.includes("mono") ||
      lowerFamily.includes("courier") ||
      lowerFamily.includes("code")
    ) {
      return { type: "Google Fonts", name: "IBM Plex Mono" };
    }

    // Default to Inter for sans-serif
    return { type: "Google Fonts", name: "Inter" };
  }

  return null;
}

/**
 * Analyze border radius from computed styles
 */
export function analyzeBorderRadius(
  stylesData: Array<{
    element: string;
    styles: Record<string, string>;
    importance: number;
  }>,
): string {
  const radii: number[] = [];

  for (const { styles, importance } of stylesData) {
    const radius = styles.borderRadius;
    if (!radius || radius === "0px") continue;

    // Parse border radius (handle "8px", "0.5rem", etc)
    const match = radius.match(/^([\d.]+)(px|rem|em)/);
    if (match) {
      let value = parseFloat(match[1]);
      const unit = match[2];

      // Convert to rem for consistency
      if (unit === "px") {
        value = value / 16; // Assuming 16px = 1rem
      }

      // Weight by importance
      for (let i = 0; i < Math.ceil(importance * 10); i++) {
        radii.push(value);
      }
    }
  }

  if (radii.length === 0) {
    return "0.375rem"; // Default
  }

  // Calculate median
  radii.sort((a, b) => a - b);
  const median = radii[Math.floor(radii.length / 2)];

  // Round to common values
  if (median < 0.1) return "0rem";
  if (median < 0.3) return "0.25rem";
  if (median < 0.45) return "0.375rem";
  if (median < 0.625) return "0.5rem";
  if (median < 0.875) return "0.75rem";
  return "1rem";
}

/**
 * Analyze spacing from computed styles
 */
export function analyzeSpacing(
  stylesData: Array<{
    element: string;
    styles: Record<string, string>;
    importance: number;
  }>,
): string {
  const gaps: number[] = [];

  for (const { styles, importance } of stylesData) {
    const gap = styles.gap || styles.gridGap;
    if (!gap || gap === "0px") continue;

    const match = gap.match(/^([\d.]+)(px|rem|em)/);
    if (match) {
      let value = parseFloat(match[1]);
      const unit = match[2];

      if (unit === "px") {
        value = value / 16;
      }

      for (let i = 0; i < Math.ceil(importance * 5); i++) {
        gaps.push(value);
      }
    }
  }

  if (gaps.length === 0) {
    return "0.25rem"; // Default
  }

  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];

  // Round to common spacing values
  if (median < 0.1875) return "0.15rem";
  if (median < 0.2375) return "0.225rem";
  if (median < 0.275) return "0.25rem";
  if (median < 0.325) return "0.3rem";
  return "0.375rem";
}


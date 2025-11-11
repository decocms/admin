import type { Theme, ThemeVariable } from "../theme.ts";

export interface ColorInfo {
  hex: string;
  rgb: { r: number; g: number; b: number };
  frequency: number;
  importance: number; // 0-1, based on element type and position
  elementType?: string;
}

export interface ColorPalette {
  primary: string;
  secondary: string;
  background: string;
  foreground: string;
  accent: string;
  border: string;
  muted: string;
  destructive: string;
  success: string;
  warning: string;
}

/**
 * Convert hex color to RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

/**
 * Convert RGB to hex
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Calculate color distance using Delta E (simplified)
 */
export function colorDistance(
  rgb1: { r: number; g: number; b: number },
  rgb2: { r: number; g: number; b: number },
): number {
  const rDiff = rgb1.r - rgb2.r;
  const gDiff = rgb1.g - rgb2.g;
  const bDiff = rgb1.b - rgb2.b;
  return Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
}

/**
 * Check if a color is too similar to white or black, or is grayscale
 */
export function isNeutralColor(rgb: { r: number; g: number; b: number }): boolean {
  const { r, g, b } = rgb;
  const avg = (r + g + b) / 3;
  const variance = Math.max(Math.abs(r - avg), Math.abs(g - avg), Math.abs(b - avg));
  
  // Calculate saturation
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  
  // Very light or very dark colors are neutral
  if (avg > 240 || avg < 15) return true;
  
  // Low saturation = grayscale = neutral
  if (saturation < 0.15) return true;
  
  // Light grays (common in borders/backgrounds)
  if (avg > 200 && variance < 15) return true;
  
  return false;
}

/**
 * Calculate relative luminance for WCAG contrast
 */
export function getLuminance(rgb: { r: number; g: number; b: number }): number {
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((val) => {
    const normalized = val / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(
  rgb1: { r: number; g: number; b: number },
  rgb2: { r: number; g: number; b: number },
): number {
  const lum1 = getLuminance(rgb1);
  const lum2 = getLuminance(rgb2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Ensure a foreground color has sufficient contrast with background
 */
export function ensureContrast(
  bgColor: string,
  fgColor: string,
  minContrast = 4.5,
): string {
  const bgRgb = hexToRgb(bgColor);
  const fgRgb = hexToRgb(fgColor);
  const contrast = getContrastRatio(bgRgb, fgRgb);

  if (contrast >= minContrast) {
    return fgColor;
  }

  // If contrast is too low, return black or white depending on background
  const bgLuminance = getLuminance(bgRgb);
  return bgLuminance > 0.5 ? "#000000" : "#ffffff";
}

/**
 * Group similar colors together
 */
export function groupSimilarColors(
  colors: ColorInfo[],
  threshold = 30,
): ColorInfo[] {
  const groups: ColorInfo[] = [];

  for (const color of colors) {
    let foundGroup = false;

    for (const group of groups) {
      if (colorDistance(color.rgb, group.rgb) < threshold) {
        // Merge into existing group
        group.frequency += color.frequency;
        group.importance = Math.max(group.importance, color.importance);
        foundGroup = true;
        break;
      }
    }

    if (!foundGroup) {
      groups.push({ ...color });
    }
  }

  return groups.sort((a, b) => {
    const scoreA = a.frequency * a.importance;
    const scoreB = b.frequency * b.importance;
    return scoreB - scoreA;
  });
}

/**
 * Extract color palette from analyzed colors
 */
export function extractColorPalette(colors: ColorInfo[]): ColorPalette {
  const grouped = groupSimilarColors(colors);
  
  // Separate by luminance and saturation
  const veryLight = grouped.filter(c => getLuminance(c.rgb) > 0.9);
  const light = grouped.filter(c => {
    const lum = getLuminance(c.rgb);
    return lum > 0.7 && lum <= 0.9;
  });
  const medium = grouped.filter(c => {
    const lum = getLuminance(c.rgb);
    return lum > 0.3 && lum <= 0.7;
  });
  const dark = grouped.filter(c => {
    const lum = getLuminance(c.rgb);
    return lum > 0.1 && lum <= 0.3;
  });
  const veryDark = grouped.filter(c => getLuminance(c.rgb) <= 0.1);

  // Filter colorful vs neutral
  const colorfulColors = grouped.filter(c => !isNeutralColor(c.rgb));
  const neutralColors = grouped.filter(c => isNeutralColor(c.rgb));

  // Sort colorful colors by importance score with HEAVY button bias
  const sortedColorful = colorfulColors.sort((a, b) => {
    // INCREASED: Massive boost for button/link colors - these are almost always the primary brand color
    const buttonBoostA = (a.elementType === "button" || a.elementType === "a") ? 1000 : 0;
    const buttonBoostB = (b.elementType === "button" || b.elementType === "a") ? 1000 : 0;
    
    const scoreA = (a.frequency * a.importance) + buttonBoostA;
    const scoreB = (b.frequency * b.importance) + buttonBoostB;
    return scoreB - scoreA;
  });

  // Background: most common very light color
  const background = veryLight
    .sort((a, b) => b.frequency - a.frequency)[0]?.hex || "#ffffff";

  // Foreground: most common very dark color with good contrast
  const foregroundCandidate = veryDark
    .sort((a, b) => b.frequency - a.frequency)[0]?.hex || 
    dark.sort((a, b) => b.frequency - a.frequency)[0]?.hex || "#000000";
  const foreground = ensureContrast(background, foregroundCandidate);

  // Primary: most important colorful color (prefer medium luminance and good saturation)
  let primary = sortedColorful[0]?.hex;
  
  // Filter: If the top color is too light, dark, or grayscale, find a better primary
  if (primary) {
    const primaryRgb = hexToRgb(primary);
    const primaryLum = getLuminance(primaryRgb);
    
    // Calculate saturation for the primary color
    const { r, g, b } = primaryRgb;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const primarySat = max === 0 ? 0 : (max - min) / max;
    
    // If primary is too extreme or not saturated enough, find a better one
    if (primaryLum > 0.85 || primaryLum < 0.15 || primarySat < 0.2) {
      // Try to find a medium luminance, well-saturated colorful color
      const betterPrimary = sortedColorful.find(c => {
        const lum = getLuminance(c.rgb);
        const cMax = Math.max(c.rgb.r, c.rgb.g, c.rgb.b);
        const cMin = Math.min(c.rgb.r, c.rgb.g, c.rgb.b);
        const cSat = cMax === 0 ? 0 : (cMax - cMin) / cMax;
        
        return lum > 0.2 && lum < 0.75 && cSat > 0.3;
      });
      if (betterPrimary) {
        primary = betterPrimary.hex;
      }
    }
    
    // Final validation: ensure primary has good contrast with background
    const bgRgb = hexToRgb(background);
    const contrast = getContrastRatio(primaryRgb, bgRgb);
    
    // If contrast is too low (< 2.5), the colors are too similar
    if (contrast < 2.5) {
      // Find a color with better contrast
      const contrastPrimary = sortedColorful.find(c => {
        const cContrast = getContrastRatio(c.rgb, bgRgb);
        const lum = getLuminance(c.rgb);
        return cContrast >= 2.5 && lum > 0.2 && lum < 0.75;
      });
      if (contrastPrimary) {
        primary = contrastPrimary.hex;
      }
    }
  }
  primary = primary || "#3b82f6";

  // Secondary: second most important colorful color (different from primary)
  const secondary = sortedColorful.find(c => 
    c.hex !== primary && colorDistance(c.rgb, hexToRgb(primary)) > 60
  )?.hex || "#64748b";

  // Accent: lighter or more saturated variant
  const accent = light.find(c => 
    !isNeutralColor(c.rgb) && c.hex !== primary && c.hex !== secondary
  )?.hex || "#e2e8f0";

  // Border: light gray/neutral
  const border = light.find(c => isNeutralColor(c.rgb))?.hex || 
    neutralColors.find(c => getLuminance(c.rgb) > 0.75)?.hex || "#e5e7eb";

  // Muted: slightly darker than background
  const muted = veryLight
    .filter(c => c.hex !== background && isNeutralColor(c.rgb))
    .sort((a, b) => b.frequency - a.frequency)[0]?.hex || 
    light.find(c => isNeutralColor(c.rgb))?.hex || "#f3f4f6";

  // Smart status color detection
  const destructive = detectStatusColor(sortedColorful, "red") || "#ef4444";
  const success = detectStatusColor(sortedColorful, "green") || "#10b981";
  const warning = detectStatusColor(sortedColorful, "yellow") || "#f59e0b";

  return {
    primary,
    secondary,
    background,
    foreground,
    accent,
    border,
    muted,
    destructive,
    success,
    warning,
  };
}

/**
 * Detect status colors (red, green, yellow/orange) from palette
 */
function detectStatusColor(
  colors: ColorInfo[],
  type: "red" | "green" | "yellow",
): string | null {
  const candidate = colors.find(c => {
    const { r, g, b } = c.rgb;
    
    switch (type) {
      case "red":
        // Red is dominant, not too dark or light
        return r > 150 && r > g + 40 && r > b + 40 && 
               getLuminance(c.rgb) > 0.2 && getLuminance(c.rgb) < 0.7;
      
      case "green":
        // Green is dominant
        return g > 120 && g > r + 30 && g > b + 30 &&
               getLuminance(c.rgb) > 0.2 && getLuminance(c.rgb) < 0.7;
      
      case "yellow":
        // Yellow/Orange: R and G are high, B is lower
        return r > 180 && g > 120 && r > b + 60 && g > b + 40 &&
               Math.abs(r - g) < 80 && getLuminance(c.rgb) > 0.3;
      
      default:
        return false;
    }
  });

  return candidate?.hex || null;
}

/**
 * Adjust color brightness (darken or lighten)
 * @param hex - Hex color string
 * @param percent - Percentage to adjust (-100 to 100, negative = darken, positive = lighten)
 */
export function adjustBrightness(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  const factor = percent / 100;
  
  let { r, g, b } = rgb;
  
  if (percent < 0) {
    // Darken
    const mult = 1 + factor;
    r = Math.max(0, Math.round(r * mult));
    g = Math.max(0, Math.round(g * mult));
    b = Math.max(0, Math.round(b * mult));
  } else {
    // Lighten
    r = Math.min(255, Math.round(r + (255 - r) * factor));
    g = Math.min(255, Math.round(g + (255 - g) * factor));
    b = Math.min(255, Math.round(b + (255 - b) * factor));
  }
  
  return rgbToHex(r, g, b);
}

/**
 * Map color palette to Theme variables
 */
export function paletteToTheme(palette: ColorPalette): Partial<Record<ThemeVariable, string>> {
  const primaryFg = ensureContrast(palette.primary, "#ffffff");
  const secondaryFg = ensureContrast(palette.secondary, palette.foreground);
  const accentFg = ensureContrast(palette.accent, palette.foreground);

  return {
    "--background": palette.background,
    "--foreground": palette.foreground,
    "--primary": palette.primary,
    "--primary-foreground": primaryFg,
    "--secondary": palette.secondary,
    "--secondary-foreground": secondaryFg,
    "--accent": palette.accent,
    "--accent-foreground": accentFg,
    "--muted": palette.muted,
    "--muted-foreground": ensureContrast(palette.muted, palette.foreground, 3),
    "--border": palette.border,
    "--input": palette.border,
    "--ring": palette.primary,
    "--card": palette.background,
    "--card-foreground": palette.foreground,
    "--popover": palette.background,
    "--popover-foreground": palette.foreground,
    "--destructive": palette.destructive,
    "--destructive-foreground": ensureContrast(palette.destructive, "#ffffff"),
    "--success": palette.success,
    "--success-foreground": ensureContrast(palette.success, "#ffffff", 3),
    "--warning": palette.warning,
    "--warning-foreground": ensureContrast(palette.warning, "#000000", 4.5),
    "--sidebar": palette.muted,
    "--sidebar-foreground": palette.foreground,
    "--sidebar-accent": palette.accent,
    "--sidebar-accent-foreground": accentFg,
    "--sidebar-border": palette.border,
    // Chart colors - variations of primary and accent
    "--chart-1": palette.primary,
    "--chart-2": palette.secondary,
    "--chart-3": palette.accent,
    "--chart-4": palette.success,
    "--chart-5": palette.warning,
  };
}

/**
 * Analyze colors from DOM computed styles
 */
export function analyzeColorsFromStyles(
  stylesData: Array<{
    element: string;
    styles: Record<string, string>;
    importance: number;
  }>,
): ColorInfo[] {
  const colorMap = new Map<string, ColorInfo>();

  for (const { element, styles, importance } of stylesData) {
    // Collect all color-related properties
    const backgroundColors = [
      styles.backgroundColor,
      styles.background, // May contain colors even in gradients
    ].filter(Boolean);
    
    const textColors = [styles.color].filter(Boolean);
    
    const borderColors = [
      styles.borderColor,
      styles.borderTopColor,
      styles.borderRightColor,
      styles.borderBottomColor,
      styles.borderLeftColor,
      styles.outlineColor,
    ].filter(Boolean);
    
    const svgColors = [
      styles.fill,
      styles.stroke,
    ].filter(Boolean);

    // Massive boost for button backgrounds - these are usually the primary brand color
    let bgWeight = importance * 1.5;
    if (element === "button" || element === "a") {
      bgWeight = importance * 5.0; // 5x weight for buttons/links!
    }

    // Process background colors (extract from gradients if needed)
    for (const colorValue of backgroundColors) {
      // Extract colors from gradients
      if (colorValue.includes("gradient")) {
        const gradientColors = extractColorsFromGradient(colorValue);
        for (const color of gradientColors) {
          processColor(color, element, bgWeight, colorMap);
        }
      } else {
        processColor(colorValue, element, bgWeight, colorMap);
      }
    }

    // Text colors
    for (const colorValue of textColors) {
      processColor(colorValue, element, importance * 1.2, colorMap);
    }

    // Process border colors with lower weight
    for (const colorValue of borderColors) {
      processColor(colorValue, element, importance * 0.8, colorMap);
    }
    
    // SVG colors (moderate weight)
    for (const colorValue of svgColors) {
      processColor(colorValue, element, importance * 1.0, colorMap);
    }
  }

  return Array.from(colorMap.values());
}

/**
 * Extract colors from CSS gradient strings
 */
function extractColorsFromGradient(gradient: string): string[] {
  const colors: string[] = [];
  
  // Match rgb(), rgba(), hsl(), hsla(), and hex colors in gradients
  const colorPatterns = [
    /rgb\([^)]+\)/g,
    /rgba\([^)]+\)/g,
    /hsl\([^)]+\)/g,
    /hsla\([^)]+\)/g,
    /#[0-9a-f]{3,8}/gi,
  ];
  
  for (const pattern of colorPatterns) {
    const matches = gradient.match(pattern);
    if (matches) {
      colors.push(...matches);
    }
  }
  
  return colors;
}

/**
 * Process a color value and add to color map
 */
function processColor(
  colorValue: string,
  element: string,
  importance: number,
  colorMap: Map<string, ColorInfo>,
): void {
  if (!colorValue || colorValue === "transparent" || colorValue === "rgba(0, 0, 0, 0)") {
    return;
  }

  // Convert to hex
  let hex = colorValue;
  if (colorValue.startsWith("rgb")) {
    const match = colorValue.match(/[\d.]+/g);
    if (match && match.length >= 3) {
      const r = parseInt(match[0]);
      const g = parseInt(match[1]);
      const b = parseInt(match[2]);
      
      // Skip fully transparent colors
      if (match.length >= 4 && parseFloat(match[3]) === 0) {
        return;
      }
      
      hex = rgbToHex(r, g, b);
    }
  } else if (colorValue.startsWith("hsl")) {
    // Basic HSL support - convert to rgb then hex
    const match = colorValue.match(/[\d.]+/g);
    if (match && match.length >= 3) {
      const h = parseFloat(match[0]);
      const s = parseFloat(match[1]) / 100;
      const l = parseFloat(match[2]) / 100;
      const rgb = hslToRgb(h, s, l);
      hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    }
  }

  if (!hex.startsWith("#")) {
    return;
  }

  const rgb = hexToRgb(hex);
  
  // Skip colors that are too similar to pure white or pure black
  const luminance = getLuminance(rgb);
  if (luminance > 0.98 || luminance < 0.02) {
    return;
  }

  // Calculate color saturation to boost colorful colors
  const { r, g, b } = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  
  // Boost importance for saturated colors (brand colors are usually saturated)
  let finalImportance = importance;
  if (saturation > 0.3) {
    // Saturated colors get a boost (1.2x to 2.0x based on saturation)
    finalImportance *= (1 + saturation);
  }

  const existing = colorMap.get(hex);

  if (existing) {
    existing.frequency++;
    existing.importance = Math.max(existing.importance, finalImportance);
  } else {
    colorMap.set(hex, {
      hex,
      rgb,
      frequency: 1,
      importance: finalImportance,
      elementType: element,
    });
  }
}

/**
 * Convert HSL to RGB
 */
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h = h / 360;
  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}


import type { Theme, ThemeVariable } from "../theme.ts";
import {
  analyzeColorsFromStyles,
  extractColorPalette,
  paletteToTheme,
  adjustBrightness,
  getLuminance,
  hexToRgb,
  type ColorInfo,
} from "./color-analysis.ts";
import {
  analyzeFontsFromStyles,
  extractBestFont,
  analyzeBorderRadius,
  analyzeSpacing,
  type FontInfo,
} from "./typography-analysis.ts";

export interface StylesData {
  element: string;
  styles: Record<string, string>;
  importance: number;
}

export interface ColorUsage {
  color: string; // hex color
  frequency: number;
  importance: number;
  type: "background" | "text" | "border";
  saturation?: number; // 0-1, color vibrancy
  score?: number; // final computed score
}

export interface ComponentColors {
  [component: string]: ColorUsage[];
}

export interface ScrapedSiteData {
  url: string;
  colors: ColorInfo[];
  fonts: FontInfo[];
  stylesData: StylesData[];
}

export interface ExtractedThemeData {
  components: ComponentColors;
  fonts: FontInfo[];
  borderRadius: string;
  spacing: string;
  metadata: {
    colorsFound: number;
    fontsFound: number;
    elementsAnalyzed: number;
  };
}

export interface ExtractedTheme {
  theme: Theme;
  metadata: {
    colorsFound: number;
    fontsFound: number;
    elementsAnalyzed: number;
  };
}

/**
 * Element importance weights
 * Higher values mean more important for theme extraction
 */
const ELEMENT_IMPORTANCE: Record<string, number> = {
  button: 1.0,
  "a": 0.9,
  "nav": 0.9,
  "header": 0.8,
  "h1": 0.8,
  "h2": 0.7,
  "h3": 0.6,
  "body": 0.9,
  "main": 0.7,
  "aside": 0.5,
  "footer": 0.4,
  "div": 0.3,
  "span": 0.2,
};

/**
 * Get element importance score
 */
function getElementImportance(selector: string): number {
  const lowerSelector = selector.toLowerCase();
  
  for (const [element, importance] of Object.entries(ELEMENT_IMPORTANCE)) {
    if (lowerSelector.includes(element)) {
      return importance;
    }
  }
  
  return 0.3; // Default importance
}

/**
 * Generate JavaScript code to extract styles from the page
 * This will be executed in the browser context
 */
export function generateStyleExtractionScript(): string {
  return `
    (function() {
      const stylesData = [];
      
      // Important selectors to analyze
      const selectors = [
        'body',
        'header',
        'nav',
        'main',
        'footer',
        'button',
        'a',
        'h1, h2, h3',
        '[class*="button"]',
        '[class*="btn"]',
        '[class*="card"]',
        '[class*="header"]',
        '[class*="nav"]',
        '[class*="sidebar"]',
      ];
      
      const seenElements = new Set();
      
      for (const selector of selectors) {
        try {
          const elements = document.querySelectorAll(selector);
          const elementsArray = Array.from(elements).slice(0, 20); // Limit per selector
          
          for (const el of elementsArray) {
            // Skip if we've seen this element
            if (seenElements.has(el)) continue;
            seenElements.add(el);
            
            // Only analyze visible elements
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) continue;
            
            const computed = window.getComputedStyle(el);
            
            stylesData.push({
              element: el.tagName.toLowerCase(),
              styles: {
                backgroundColor: computed.backgroundColor,
                color: computed.color,
                borderColor: computed.borderColor,
                borderTopColor: computed.borderTopColor,
                borderRightColor: computed.borderRightColor,
                borderBottomColor: computed.borderBottomColor,
                borderLeftColor: computed.borderLeftColor,
                borderRadius: computed.borderRadius,
                fontFamily: computed.fontFamily,
                fontSize: computed.fontSize,
                fontWeight: computed.fontWeight,
                gap: computed.gap,
                gridGap: computed.gridGap,
              },
              rect: {
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
              }
            });
          }
        } catch (e) {
          console.error('Error analyzing selector:', selector, e);
        }
      }
      
      return JSON.stringify(stylesData);
    })();
  `;
}

/**
 * Normalize element name - treat button-like links as buttons
 */
function normalizeElementType(element: string, styles: Record<string, string>): string {
  // If it's a link but styled like a button, treat it as a button
  if (element === "a") {
    // Check if it has button-like styling or classes
    const styleStr = JSON.stringify(styles).toLowerCase();
    
    // Expanded CTA/button indicators
    const buttonIndicators = [
      "button", "btn",
      "cta", "call-to-action",
      "signup", "sign-up", "signin", "sign-in",
      "get-started", "getstarted", "start",
      "demo", "request", "trial",
      "download", "subscribe",
      "primary", "secondary",
      'role="button"',
      'type="button"'
    ];
    
    if (buttonIndicators.some(indicator => styleStr.includes(indicator))) {
      return "button";
    }
  }
  return element;
}

/**
 * Extract colors grouped by component type
 */
export function extractComponentColors(stylesData: Array<{
  element: string;
  styles: Record<string, string>;
  importance: number;
}>): ComponentColors {
  const componentMap = new Map<string, Map<string, ColorUsage>>();

  for (const { element: rawElement, styles, importance } of stylesData) {
    // Normalize element (e.g., button-like links become buttons)
    const element = normalizeElementType(rawElement, styles);
    
    // Initialize component map if needed
    if (!componentMap.has(element)) {
      componentMap.set(element, new Map());
    }
    const colorMap = componentMap.get(element)!;

    // Process background colors
    const bgColors = [styles.backgroundColor, styles.background].filter(Boolean);
    for (const colorValue of bgColors) {
      // Check if it's a gradient
      if (colorValue.includes("gradient")) {
        console.log(`🌈 Gradient found in ${element}:`, colorValue.slice(0, 100));
        // Extract colors from gradient (we have a function for this in color-analysis.ts)
        // For now, try to extract colors with regex
        const colorPattern = /#[0-9a-f]{3,6}|rgb\([^)]+\)|rgba\([^)]+\)|hsl\([^)]+\)|hsla\([^)]+\)/gi;
        const extractedColors = colorValue.match(colorPattern);
        if (extractedColors) {
          console.log(`  → Extracted ${extractedColors.length} colors:`, extractedColors);
          for (const color of extractedColors) {
            addColorToMap(colorMap, color, importance, "background");
          }
        }
      } else {
        addColorToMap(colorMap, colorValue, importance, "background");
      }
    }

    // Process text colors
    if (styles.color) {
      addColorToMap(colorMap, styles.color, importance, "text");
    }

    // Process border colors
    const borderColors = [
      styles.borderColor,
      styles.borderTopColor,
      styles.outlineColor,
    ].filter(Boolean);
    for (const colorValue of borderColors) {
      addColorToMap(colorMap, colorValue, importance, "border");
    }
  }

  // Analyze visual context across all components
  const allColors = new Map<string, ColorUsage[]>();
  for (const colors of componentMap.values()) {
    for (const color of colors.values()) {
      const hex = color.color;
      if (!allColors.has(hex)) {
        allColors.set(hex, []);
      }
      allColors.get(hex)!.push(color);
    }
  }

  // Convert Map to ComponentColors format with smart scoring
  const result: ComponentColors = {};
  for (const [component, colorMap] of componentMap.entries()) {
    const colors = Array.from(colorMap.values());
    
    // Calculate smart scores for each color
    for (const color of colors) {
      let score = color.frequency * color.importance;
      
      // Calculate luminance for filtering
      const rgb = hexToRgb(color.color);
      const luminance = getLuminance(rgb);
      
      // Saturation boost: vibrant colors (saturation > 0.5) get 3x boost
      if (color.saturation && color.saturation > 0.5) {
        score *= 1 + (color.saturation * 2); // Up to 3x for fully saturated
      }
      
      // Type boost: background colors of buttons are most important
      if (component === "button" && color.type === "background") {
        // INCREASED: 10x -> 20x for button backgrounds
        score *= 20;
        
        // Extra boost for saturated button colors (likely brand colors)
        if (color.saturation && color.saturation > 0.4) {
          score *= 2; // Additional 2x for saturated button backgrounds
        }
        
        // Filter out very light or very dark button backgrounds
        // These are likely hover states or disabled buttons, not primary
        if (luminance > 0.85 || luminance < 0.15) {
          score *= 0.1; // Heavy penalty for extreme luminance
        }
      } else if (component === "button") {
        score *= 5; // Good boost for other button properties
      } else if (component === "a" && color.type === "background") {
        score *= 3; // Links with backgrounds are important
      }
      
      // Consistency boost: check if color appears in multiple types
      const sameColorDiffTypes = colors.filter(c => 
        c.color === color.color && c.type !== color.type
      );
      if (sameColorDiffTypes.length > 0) {
        score *= 1.5; // Color used consistently (bg + border, etc)
      }
      
      // Multi-context boost: if color appears in multiple components
      const allUsages = allColors.get(color.color) || [];
      const uniqueComponents = new Set(allUsages.map((_, idx) => 
        Array.from(componentMap.keys())[idx]
      )).size;
      if (uniqueComponents > 1) {
        score *= 1.3; // Appears in multiple contexts
      }
      
      // Uniqueness boost: if color appears in ≤3 total elements, likely brand color
      const totalFreq = allUsages.reduce((sum, c) => sum + c.frequency, 0);
      if (totalFreq > 0 && totalFreq <= 3 && color.saturation && color.saturation > 0.4) {
        score *= 2; // Rare + saturated = probably brand color
      }
      
      // Grayscale penalty: reduce importance of grayscale colors
      if (color.saturation && color.saturation < 0.1) {
        score *= 0.5; // Likely neutral/structural color
      }
      
      color.score = score;
    }
    
    // Sort by score (descending)
    result[component] = colors.sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  return result;
}

/**
 * Calculate color saturation (0-1)
 */
function calculateSaturation(hex: string): number {
  if (!hex.startsWith('#') || hex.length < 7) return 0;
  
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  
  if (max === 0) return 0;
  return (max - min) / max;
}

/**
 * Helper to add color to component's color map
 */
function addColorToMap(
  colorMap: Map<string, ColorUsage>,
  colorValue: string,
  importance: number,
  type: "background" | "text" | "border",
): void {
  if (!colorValue || colorValue === "transparent") return;

  // Clean the color value first (remove !important, spaces, etc)
  colorValue = colorValue.trim().replace(/\s*!important\s*/g, '');

  // Check if it's a CSS variable that wasn't resolved
  if (colorValue.includes("var(")) {
    console.log(`⚠️  Unresolved CSS variable: ${colorValue}`);
    return; // Skip unresolved variables
  }

  // Convert to hex
  let hex = colorValue;
  
  if (colorValue.startsWith("rgb")) {
    const match = colorValue.match(/[\d.]+/g);
    if (match && match.length >= 3) {
      const r = parseInt(match[0]);
      const g = parseInt(match[1]);
      const b = parseInt(match[2]);
      hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    }
  } else if (colorValue.startsWith("hsl")) {
    // Convert HSL to hex
    const match = colorValue.match(/[\d.]+/g);
    if (match && match.length >= 3) {
      const h = parseFloat(match[0]);
      const s = parseFloat(match[1]) / 100;
      const l = parseFloat(match[2]) / 100;
      const rgb = hslToRgb(h, s, l);
      hex = `#${((1 << 24) + (rgb.r << 16) + (rgb.g << 8) + rgb.b).toString(16).slice(1)}`;
    }
  } else if (colorValue.startsWith("#")) {
    // Normalize hex (expand 3-digit to 6-digit)
    if (hex.length === 4) {
      hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    }
  }

  if (!hex.startsWith("#")) return;

  // Calculate saturation
  const saturation = calculateSaturation(hex);

  const key = `${hex}-${type}`;
  const existing = colorMap.get(key);

  if (existing) {
    existing.frequency++;
    existing.importance = Math.max(existing.importance, importance);
    existing.saturation = saturation; // Update saturation
  } else {
    colorMap.set(key, {
      color: hex,
      frequency: 1,
      importance,
      type,
      saturation,
    });
  }
}

/**
 * Simple HSL to RGB conversion
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

/**
 * Map component colors to theme variables intelligently (NEW: score-based)
 */
export function mapComponentColorsToTheme(components: ComponentColors): Partial<Record<ThemeVariable, string>> {
  // Primary: Find the most prominent brand color across ALL components
  let primary = "#3b82f6"; // fallback
  
  // Get ALL saturated background colors sorted by score (includes buttons, links, headers, etc)
  const allBrandColors = Object.values(components)
    .flat()
    .filter(c => 
      c.saturation && c.saturation > 0.25 && // Well saturated (lowered threshold)
      c.type === "background" && // Background colors are more important
      c.score && c.score > 5 // Lower score threshold to catch more colors
    )
    .sort((a, b) => (b.score || 0) - (a.score || 0));
  
  console.log(`🔍 Found ${allBrandColors.length} potential brand colors (saturated backgrounds)`);
  if (allBrandColors.length > 0) {
    console.log(`   Top 3:`, allBrandColors.slice(0, 3).map(c => 
      `${c.color} (score: ${Math.round(c.score || 0)}, sat: ${Math.round((c.saturation || 0) * 100)}%)`
    ));
  }
  
  // Get button-specific colors
  const buttonBgs = components.button?.filter(c => c.type === "background") || [];
  const buttonSaturated = buttonBgs.filter(c => c.saturation && c.saturation > 0.25);
  
  console.log(`🔘 Found ${buttonSaturated.length} saturated button backgrounds`);
  if (buttonSaturated.length > 0) {
    console.log(`   Top button:`, `${buttonSaturated[0].color} (score: ${Math.round(buttonSaturated[0].score || 0)})`);
  }
  
  // NEW STRATEGY: Always prefer the highest scoring saturated color across ALL components
  // This ensures we get the most prominent brand color, not just from buttons
  if (allBrandColors.length > 0) {
    const topBrand = allBrandColors[0];
    
    // Validate it's not too dark or too light
    const brandLum = getLuminance(hexToRgb(topBrand.color));
    
    if (brandLum > 0.15 && brandLum < 0.85) {
      // Good luminance range
      primary = topBrand.color;
      console.log(`✅ Primary selected: ${primary} (score: ${Math.round(topBrand.score || 0)}, lum: ${brandLum.toFixed(2)})`);
    } else {
      // Try next color
      const alternativeBrand = allBrandColors.find(c => {
        const lum = getLuminance(hexToRgb(c.color));
        return lum > 0.15 && lum < 0.85;
      });
      
      if (alternativeBrand) {
        primary = alternativeBrand.color;
        console.log(`✅ Primary selected (alternative): ${primary} (score: ${Math.round(alternativeBrand.score || 0)})`);
      } else if (buttonSaturated.length > 0) {
        // Fallback to button
        primary = buttonSaturated[0].color;
        console.log(`✅ Primary from button (fallback): ${primary}`);
      }
    }
  } else if (buttonSaturated.length > 0) {
    // No brand colors found, use button
    primary = buttonSaturated[0].color;
    console.log(`✅ Primary from button (no brand colors): ${primary}`);
  } else if (buttonBgs.length > 0) {
    // Any button background
    primary = buttonBgs[0].color;
    console.log(`✅ Primary from any button: ${primary}`);
  } else {
    // Last resort: look for saturated colors in links
    const linkBgs = components.a?.filter(c => 
      c.type === "background" && c.saturation && c.saturation > 0.25
    ) || [];
    if (linkBgs.length > 0) {
      primary = linkBgs[0].color;
      console.log(`✅ Primary from link: ${primary}`);
    } else {
      console.log(`⚠️  No good primary color found, using fallback: ${primary}`);
    }
  }
  
  // Background/Foreground from body - with validation
  const bodyColors = components.body || [];
  
  // Get highest scoring background and text colors
  const bodyBgCandidates = bodyColors
    .filter(c => c.type === "background")
    .sort((a, b) => (b.score || 0) - (a.score || 0));
  const bodyTextCandidates = bodyColors
    .filter(c => c.type === "text")
    .sort((a, b) => (b.score || 0) - (a.score || 0));
  
  let bodyBg = bodyBgCandidates[0]?.color || "#ffffff";
  let bodyText = bodyTextCandidates[0]?.color || "#0a0a0a";
  
  // VALIDATION: Ensure background is lighter than foreground
  // If they're inverted, swap them
  const bgLuminance = getLuminance(hexToRgb(bodyBg));
  const textLuminance = getLuminance(hexToRgb(bodyText));
  
  if (bgLuminance < textLuminance) {
    // Background is darker than text - likely inverted!
    console.log("⚠️  Background/Foreground detected as inverted, swapping...");
    console.log(`   Was: BG=${bodyBg} (lum: ${bgLuminance.toFixed(2)}), Text=${bodyText} (lum: ${textLuminance.toFixed(2)})`);
    [bodyBg, bodyText] = [bodyText, bodyBg]; // Swap
    console.log(`   Now: BG=${bodyBg}, Text=${bodyText}`);
  }
  
  // Secondary: nav/header background, or second button color
  let secondary = "#f5f5f5";
  const navBg = components.nav?.find(c => c.type === "background");
  const headerBg = components.header?.find(c => c.type === "background");
  
  if (navBg && navBg.score && navBg.score > 5) {
    secondary = navBg.color;
  } else if (headerBg && headerBg.score && headerBg.score > 5) {
    secondary = headerBg.color;
  } else if (buttonBgs.length > 1) {
    secondary = buttonBgs[1].color;
  }
  
  // Accent: different from primary, medium saturation
  let accent = secondary;
  const allSaturatedColors = Object.values(components)
    .flat()
    .filter(c => 
      c.saturation && c.saturation > 0.2 && c.saturation < 0.8 &&
      c.color !== primary && c.color !== secondary
    )
    .sort((a, b) => (b.score || 0) - (a.score || 0));
  
  if (allSaturatedColors.length > 0) {
    accent = allSaturatedColors[0].color;
  }
  
  // Button text (ensure contrast)
  const buttonText = components.button?.find(c => c.type === "text")?.color || "#ffffff";
  
  // Borders/Muted: low saturation colors
  const lowSatColors = Object.values(components)
    .flat()
    .filter(c => c.saturation && c.saturation < 0.15)
    .sort((a, b) => (b.score || 0) - (a.score || 0));
  
  const border = lowSatColors.find(c => {
    const r = parseInt(c.color.slice(1, 3), 16);
    const g = parseInt(c.color.slice(3, 5), 16);
    const b = parseInt(c.color.slice(5, 7), 16);
    const avg = (r + g + b) / 3;
    return avg > 180 && avg < 240; // Light gray range
  })?.color || "#e5e7eb";
  
  const muted = lowSatColors.find(c => {
    const r = parseInt(c.color.slice(1, 3), 16);
    const g = parseInt(c.color.slice(3, 5), 16);
    const b = parseInt(c.color.slice(5, 7), 16);
    const avg = (r + g + b) / 3;
    return avg > 220; // Very light gray
  })?.color || "#f5f5f5";

  // SIDEBAR COLORS: Extract from nav/aside/header or use body background with variation
  let sidebarBg = bodyBg;
  let sidebarFg = bodyText;
  let sidebarBorder = border;
  let sidebarAccent = accent;
  
  // Try to extract real sidebar/nav colors
  const navColors = components.nav || [];
  const asideColors = components.aside || [];
  const headerColors = components.header || [];
  
  // Priority 1: nav background and text
  const navBackground = navColors.find(c => c.type === "background");
  const navText = navColors.find(c => c.type === "text");
  
  if (navBackground && navBackground.score && navBackground.score > 3) {
    sidebarBg = navBackground.color;
    if (navText) {
      sidebarFg = navText.color;
    }
    const navBorderColor = navColors.find(c => c.type === "border");
    if (navBorderColor) {
      sidebarBorder = navBorderColor.color;
    }
  } 
  // Priority 2: aside (sidebar) background and text
  else if (asideColors.length > 0) {
    const asideBg = asideColors.find(c => c.type === "background");
    const asideText = asideColors.find(c => c.type === "text");
    
    if (asideBg && asideBg.score && asideBg.score > 3) {
      sidebarBg = asideBg.color;
      if (asideText) {
        sidebarFg = asideText.color;
      }
    }
  }
  // Priority 3: header colors (if different from nav)
  else if (headerColors.length > 0 && headerBg && headerBg.score && headerBg.score > 3) {
    sidebarBg = headerBg.color;
    const headerText = headerColors.find(c => c.type === "text");
    if (headerText) {
      sidebarFg = headerText.color;
    }
  }
  // Fallback: use body background with 5% variation
  else {
    const bodyLuminance = getLuminance(hexToRgb(bodyBg));
    // If light background, darken sidebar slightly; if dark, lighten it
    if (bodyLuminance > 0.5) {
      sidebarBg = adjustBrightness(bodyBg, -5); // Darken 5%
    } else {
      sidebarBg = adjustBrightness(bodyBg, 5); // Lighten 5%
    }
  }
  
  // Sidebar accent: try to use a hover/active state from nav
  const navAccentCandidate = navColors.find(c => 
    c.color !== sidebarBg && c.saturation && c.saturation > 0.1
  );
  if (navAccentCandidate) {
    sidebarAccent = navAccentCandidate.color;
  } else {
    // Fallback: slightly different shade of sidebar background
    const sidebarLuminance = getLuminance(hexToRgb(sidebarBg));
    sidebarAccent = sidebarLuminance > 0.5 
      ? adjustBrightness(sidebarBg, -8) 
      : adjustBrightness(sidebarBg, 8);
  }

  return {
    "--background": bodyBg,
    "--foreground": bodyText,
    "--primary": primary,
    "--primary-foreground": buttonText,
    "--secondary": secondary,
    "--secondary-foreground": bodyText,
    "--card": bodyBg,
    "--card-foreground": bodyText,
    "--popover": bodyBg,
    "--popover-foreground": bodyText,
    "--accent": accent,
    "--accent-foreground": bodyText,
    "--border": border,
    "--input": border,
    "--ring": primary,
    "--muted": muted,
    "--muted-foreground": "#737373",
    "--sidebar": sidebarBg,
    "--sidebar-foreground": sidebarFg,
    "--sidebar-accent": sidebarAccent,
    "--sidebar-accent-foreground": sidebarFg,
    "--sidebar-border": sidebarBorder,
  };
}

/**
 * Process scraped data into a Theme (LEGACY - uses smart guessing)
 */
export function processScrapedData(data: ScrapedSiteData): ExtractedTheme {
  // Enrich styles data with importance scores
  const enrichedStylesData = data.stylesData.map((item) => ({
    ...item,
    importance: getElementImportance(item.element),
  }));

  // Analyze colors
  const colors = analyzeColorsFromStyles(enrichedStylesData);
  
  // Log top colors for debugging
  const topColors = colors
    .sort((a, b) => (b.frequency * b.importance) - (a.frequency * a.importance))
    .slice(0, 10);
  console.log('🎨 Top 10 colors found:', topColors.map(c => ({
    hex: c.hex,
    element: c.elementType,
    score: Math.round(c.frequency * c.importance),
    freq: c.frequency,
    importance: Math.round(c.importance * 10) / 10,
  })));
  
  const palette = extractColorPalette(colors);
  console.log('🎨 Extracted palette:', {
    primary: palette.primary,
    secondary: palette.secondary,
    background: palette.background,
    foreground: palette.foreground,
  });
  
  const themeVariables = paletteToTheme(palette);

  // Analyze fonts
  const fonts = analyzeFontsFromStyles(enrichedStylesData);
  const bestFont = extractBestFont(fonts);

  // Analyze border radius and spacing
  const borderRadius = analyzeBorderRadius(enrichedStylesData);
  const spacing = analyzeSpacing(enrichedStylesData);

  // Build final theme
  const theme: Theme = {
    variables: {
      ...themeVariables,
      "--radius": borderRadius,
      "--spacing": spacing,
    },
    font: bestFont,
  };

  return {
    theme,
    metadata: {
      colorsFound: colors.length,
      fontsFound: fonts.length,
      elementsAnalyzed: data.stylesData.length,
    },
  };
}

/**
 * Process scraped data into component-grouped colors (NEW APPROACH)
 */
export function processScrapedDataV2(data: ScrapedSiteData): ExtractedThemeData {
  // Enrich styles data with importance scores
  const enrichedStylesData = data.stylesData.map((item) => ({
    ...item,
    importance: getElementImportance(item.element),
  }));

  // Debug: Log sample of raw styles data
  console.log('🔍 Sample raw styles (first 5):');
  enrichedStylesData.slice(0, 5).forEach((item, i) => {
    console.log(`  [${i}] ${item.element}:`, {
      bg: item.styles.backgroundColor || item.styles.background,
      color: item.styles.color,
      importance: Math.round(item.importance * 10) / 10,
    });
  });

  // Extract colors grouped by component
  const components = extractComponentColors(enrichedStylesData);

  // Debug: Search for Supabase green or similar colors
  console.log('🔍 Searching for green colors (like #3fcf8e):');
  for (const [component, colors] of Object.entries(components)) {
    const greenColors = colors.filter(c => {
      const hex = c.color.toLowerCase();
      // Check if it's greenish (more green than red/blue)
      if (hex.startsWith('#')) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return g > r && g > b && g > 100; // Greenish and not too dark
      }
      return false;
    });
    if (greenColors.length > 0) {
      console.log(`  ${component}:`, greenColors.map(c => ({
        color: c.color,
        type: c.type,
        freq: c.frequency,
      })));
    }
  }

  // Log component colors for debugging (show top 5 per component with scores)
  console.log('🎨 Colors by component (sorted by score):');
  for (const [component, colors] of Object.entries(components)) {
    if (colors.length > 0) {
      console.log(`  ${component}:`, colors.slice(0, 5).map(c => ({
        color: c.color,
        type: c.type,
        freq: c.frequency,
        sat: Math.round((c.saturation || 0) * 100) + '%',
        score: Math.round(c.score || 0),
      })));
    }
  }
  
  // Extra debug for body colors
  const bodyColorsDebug = components.body || [];
  if (bodyColorsDebug.length > 0) {
    console.log('🔍 Body colors in detail:');
    console.log('  Backgrounds:', bodyColorsDebug.filter(c => c.type === 'background').map(c => 
      `${c.color} (score: ${Math.round(c.score || 0)}, freq: ${c.frequency})`
    ));
    console.log('  Texts:', bodyColorsDebug.filter(c => c.type === 'text').map(c => 
      `${c.color} (score: ${Math.round(c.score || 0)}, freq: ${c.frequency})`
    ));
  }
  
  // Log final mapping preview
  const themeVars = mapComponentColorsToTheme(components);
  console.log('🎯 Final theme mapping:');
  console.log('  Primary:', themeVars["--primary"]);
  console.log('  Background:', themeVars["--background"]);
  console.log('  Foreground:', themeVars["--foreground"]);
  console.log('  Secondary:', themeVars["--secondary"]);

  // Analyze fonts
  const fonts = analyzeFontsFromStyles(enrichedStylesData);

  // Use default border radius and spacing (don't extract from site)
  const borderRadius = "0.375rem"; // Default
  const spacing = "0.25rem"; // Default

  // Count total unique colors
  const allColors = new Set<string>();
  for (const colors of Object.values(components)) {
    for (const { color } of colors) {
      allColors.add(color);
    }
  }

  return {
    components,
    fonts,
    borderRadius,
    spacing,
    metadata: {
      colorsFound: allColors.size,
      fontsFound: fonts.length,
      elementsAnalyzed: data.stylesData.length,
    },
  };
}

/**
 * Validate URL for security
 */
export function validateUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsedUrl = new URL(url);
    
    // Only allow http and https
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return { valid: false, error: "Only HTTP and HTTPS URLs are allowed" };
    }
    
    // Block localhost and private IPs
    const hostname = parsedUrl.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.16.") ||
      hostname.startsWith("172.17.") ||
      hostname.startsWith("172.18.") ||
      hostname.startsWith("172.19.") ||
      hostname.startsWith("172.20.") ||
      hostname.startsWith("172.21.") ||
      hostname.startsWith("172.22.") ||
      hostname.startsWith("172.23.") ||
      hostname.startsWith("172.24.") ||
      hostname.startsWith("172.25.") ||
      hostname.startsWith("172.26.") ||
      hostname.startsWith("172.27.") ||
      hostname.startsWith("172.28.") ||
      hostname.startsWith("172.29.") ||
      hostname.startsWith("172.30.") ||
      hostname.startsWith("172.31.")
    ) {
      return { valid: false, error: "Cannot scrape local or private URLs" };
    }
    
    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
}


/**
 * Theme Extractor - Extract colors from websites and generate complete themes
 * 
 * This module provides functionality to:
 * 1. Extract prominent colors from any website URL
 * 2. Analyze color contrast to determine dark/light preference
 * 3. Generate complete shadcn/ui compatible theme palettes
 * 4. Support both algorithmic and LLM-based theme generation
 */

export interface ColorExtractionResult {
  companyName?: string;
  favicon?: string;
  logo?: string;
  colors: Record<string, string>;
  isDark: boolean;
  dominantColors: string[];
  brandColors: string[];
}

export interface ThemeGenerationOptions {
  preferDark?: boolean;
  primaryColor?: string;
  useAlgorithmicOnly?: boolean;
}

// Color utility functions
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.5;
  
  const { r, g, b } = rgb;
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function getContrastRatio(color1: string, color2: string): number {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function isLightColor(hex: string): boolean {
  return getLuminance(hex) > 0.5;
}

export function getContrastColor(hex: string): string {
  return isLightColor(hex) ? "#000000" : "#ffffff";
}

export function adjustColorBrightness(color: string, amount: number): string {
  const hex = color.replace('#', '');
  const r = Math.min(255, Math.max(0, parseInt(hex.slice(0, 2), 16) + Math.round(255 * amount)));
  const g = Math.min(255, Math.max(0, parseInt(hex.slice(2, 4), 16) + Math.round(255 * amount)));
  const b = Math.min(255, Math.max(0, parseInt(hex.slice(4, 6), 16) + Math.round(255 * amount)));
  
  return rgbToHex(r, g, b);
}

export function isVibrantColor(color: string): boolean {
  const hex = color.replace('#', '');
  if (hex.length !== 6) return false;
  
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  const brightness = max / 255;
  
  return saturation > 0.3 && brightness > 0.2 && brightness < 0.9;
}

export function generateDomainBasedColor(domain: string, companyName?: string): string {
  const text = companyName || domain;
  
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  const hue = Math.abs(hash) % 360;
  const saturation = 65 + (Math.abs(hash) % 25);
  const lightness = 45 + (Math.abs(hash) % 20);
  
  const h = hue / 360;
  const s = saturation / 100;
  const l = lightness / 100;
  
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  
  const r = Math.round(hue2rgb(p, q, h + 1/3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1/3) * 255);
  
  return rgbToHex(r, g, b);
}

export async function extractColorsFromWebsite(domain: string): Promise<{
  dominantColors: string[];
  brandColors: string[];
  companyName?: string;
  favicon?: string;
  logo?: string;
}> {
  try {
    const url = domain.startsWith("http") ? domain : `https://${domain}`;
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; DecoChat/1.0)",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }

    const html = await response.text();
    
    // Extract company name from title tag
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const companyName = titleMatch ? titleMatch[1].split(/[-|–]/)[0].trim() : undefined;
    
    // Extract favicon
    const faviconMatch = html.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i);
    let favicon = faviconMatch ? faviconMatch[1] : undefined;
    if (favicon && !favicon.startsWith('http')) {
      favicon = new URL(favicon, url).href;
    }
    
    // Extract logo from common patterns
    const logoPatterns = [
      /<img[^>]*(?:class|id)=["'][^"']*logo[^"']*["'][^>]*src=["']([^"']+)["']/i,
      /<img[^>]*src=["']([^"']*logo[^"']*)["']/i,
      /<svg[^>]*(?:class|id)=["'][^"']*logo[^"']*["']/i
    ];
    
    let logo: string | undefined;
    for (const pattern of logoPatterns) {
      const match = html.match(pattern);
      if (match) {
        logo = match[1];
        if (logo && !logo.startsWith('http')) {
          logo = new URL(logo, url).href;
        }
        break;
      }
    }
    
    // Extract colors from CSS and inline styles
    const colorPatterns = [
      /#([a-fA-F0-9]{6})/g,
      /#([a-fA-F0-9]{3})/g,
      /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g,
      /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*[\d.]+\s*\)/g,
    ];
    
    const extractedColors = new Set<string>();
    
    for (const pattern of colorPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        if (match[1] && match[1].length === 6) {
          extractedColors.add(`#${match[1]}`);
        } else if (match[1] && match[1].length === 3) {
          const expanded = match[1].split('').map(c => c + c).join('');
          extractedColors.add(`#${expanded}`);
        } else if (match[2] && match[3] && match[4]) {
          const r = parseInt(match[1] || match[2]);
          const g = parseInt(match[2] || match[3]);
          const b = parseInt(match[3] || match[4]);
          if (r <= 255 && g <= 255 && b <= 255) {
            extractedColors.add(rgbToHex(r, g, b));
          }
        }
      }
    }
    
    // Filter out common colors and sort by vibrancy
    const filteredColors = Array.from(extractedColors)
      .filter(color => {
        const commonColors = ['#000000', '#ffffff', '#808080', '#f0f0f0', '#e0e0e0'];
        return !commonColors.includes(color.toLowerCase());
      })
      .sort((a, b) => {
        const aVibrant = isVibrantColor(a);
        const bVibrant = isVibrantColor(b);
        if (aVibrant && !bVibrant) return -1;
        if (!aVibrant && bVibrant) return 1;
        return getLuminance(b) - getLuminance(a);
      });
    
    const dominantColors = filteredColors.slice(0, 5);
    const brandColors = filteredColors.filter(isVibrantColor).slice(0, 3);
    
    // If no good colors found, generate one based on domain
    if (brandColors.length === 0) {
      brandColors.push(generateDomainBasedColor(domain, companyName));
    }
    
    return {
      dominantColors,
      brandColors,
      companyName,
      favicon,
      logo,
    };
  } catch (error) {
    console.error("Error extracting colors:", error);
    // Return fallback colors
    return {
      dominantColors: ["#2563eb", "#1f2937", "#6b7280"],
      brandColors: [generateDomainBasedColor(domain)],
    };
  }
}

function generateFallbackColor(varName: string, primaryColor: string, isDark: boolean): string {
  const baseColors = isDark ? {
    background: "#0a0a0a",
    foreground: "#fafafa",
    muted: "#1a1a1a",
    border: "#2a2a2a"
  } : {
    background: "#ffffff",
    foreground: "#0a0a0a", 
    muted: "#f5f5f5",
    border: "#e5e5e5"
  };
  
  switch (varName) {
    case "--background":
    case "--card":
    case "--popover":
      return baseColors.background;
    case "--foreground":
    case "--card-foreground":
    case "--popover-foreground":
      return baseColors.foreground;
    case "--primary":
      return primaryColor;
    case "--primary-foreground":
      return getContrastColor(primaryColor);
    case "--primary-light":
      return adjustColorBrightness(primaryColor, 0.2);
    case "--primary-dark":
      return adjustColorBrightness(primaryColor, -0.2);
    case "--secondary":
    case "--muted":
    case "--accent":
      return baseColors.muted;
    case "--secondary-foreground":
    case "--muted-foreground":
    case "--accent-foreground":
      return isDark ? "#a1a1aa" : "#71717a";
    case "--destructive":
      return "#dc2626";
    case "--destructive-foreground":
      return "#ffffff";
    case "--success":
      return "#16a34a";
    case "--success-foreground":
      return "#ffffff";
    case "--warning":
      return "#ea580c";
    case "--warning-foreground":
      return "#ffffff";
    case "--border":
    case "--input":
      return baseColors.border;
    case "--sidebar":
      return adjustColorBrightness(baseColors.background, isDark ? 0.05 : -0.02);
    default:
      return primaryColor;
  }
}

export function generateAlgorithmicTheme(primaryColor: string, options: ThemeGenerationOptions = {}): { colors: Record<string, string>; isDark: boolean } {
  const isDark = options.preferDark ?? !isLightColor(primaryColor);
  const colors: Record<string, string> = {};
  
  const requiredVars = [
    "--background", "--foreground", "--card", "--card-foreground",
    "--popover", "--popover-foreground", "--primary", "--primary-foreground",
    "--secondary", "--secondary-foreground", "--muted", "--muted-foreground",
    "--accent", "--accent-foreground", "--destructive", "--destructive-foreground",
    "--success", "--success-foreground", "--warning", "--warning-foreground",
    "--border", "--input", "--sidebar", "--primary-light", "--primary-dark"
  ];
  
  for (const varName of requiredVars) {
    colors[varName] = generateFallbackColor(varName, primaryColor, isDark);
  }
  
  return { colors, isDark };
}

/**
 * Main function to extract colors and generate a complete theme from a website URL
 */
export async function extractThemeFromWebsite(
  domain: string, 
  options: ThemeGenerationOptions = {}
): Promise<ColorExtractionResult> {
  console.log(`[THEME_EXTRACTOR] Starting extraction for: ${domain}`);
  
  // Step 1: Extract colors from website
  const extractedData = await extractColorsFromWebsite(domain);
  
  console.log(`[THEME_EXTRACTOR] Extracted colors:`, {
    dominantColors: extractedData.dominantColors,
    brandColors: extractedData.brandColors,
    companyName: extractedData.companyName
  });
  
  // Step 2: Generate complete theme
  const primaryColor = options.primaryColor || extractedData.brandColors[0] || extractedData.dominantColors[0] || "#2563eb";
  const themeResult = generateAlgorithmicTheme(primaryColor, options);
  
  console.log(`[THEME_EXTRACTOR] Generated ${themeResult.isDark ? 'dark' : 'light'} theme with ${Object.keys(themeResult.colors).length} variables`);
  
  return {
    companyName: extractedData.companyName,
    favicon: extractedData.favicon,
    logo: extractedData.logo,
    colors: themeResult.colors,
    isDark: themeResult.isDark,
    dominantColors: extractedData.dominantColors,
    brandColors: extractedData.brandColors,
  };
}

/**
 * Generate CSS variables string from theme colors
 */
export function generateCSSVariables(colors: Record<string, string>): string {
  return Object.entries(colors)
    .map(([variable, color]) => `  ${variable}: ${color};`)
    .join('\n');
}

/**
 * Generate complete CSS theme with :root selector
 */
export function generateThemeCSS(result: ColorExtractionResult): string {
  return `:root {
${generateCSSVariables(result.colors)}
}`;
}

/**
 * Validate theme colors for accessibility
 */
export function validateThemeAccessibility(colors: Record<string, string>): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  // Check primary contrast
  const primary = colors["--primary"];
  const primaryForeground = colors["--primary-foreground"];
  if (primary && primaryForeground) {
    const ratio = getContrastRatio(primary, primaryForeground);
    if (ratio < 4.5) {
      issues.push(`Primary color contrast ratio (${ratio.toFixed(2)}) is below WCAG AA standard (4.5:1)`);
    }
  }
  
  // Check background contrast
  const background = colors["--background"];
  const foreground = colors["--foreground"];
  if (background && foreground) {
    const ratio = getContrastRatio(background, foreground);
    if (ratio < 4.5) {
      issues.push(`Background/foreground contrast ratio (${ratio.toFixed(2)}) is below WCAG AA standard (4.5:1)`);
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}

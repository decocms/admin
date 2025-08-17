import { z } from "zod";
import { createExtractWebsiteColorsTool } from "../tools/extract-colors.ts";
import { extractCompanyContext } from "../tools/extract-company-context.ts";
import { State } from "@deco/sdk/mcp";
import type { Bindings } from "../utils/context.ts";

// Helper functions for color analysis
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.5; // fallback
  
  const { r, g, b } = rgb;
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function isLightColor(hex: string): boolean {
  return getLuminance(hex) > 0.5;
}

function getContrastColor(hex: string): string {
  return isLightColor(hex) ? "#000000" : "#ffffff";
}

// Helper function to lighten a color
function lightenColor(color: string, amount: number): string {
  const hex = color.replace('#', '');
  const r = Math.min(255, parseInt(hex.slice(0, 2), 16) + Math.round(255 * amount));
  const g = Math.min(255, parseInt(hex.slice(2, 4), 16) + Math.round(255 * amount));
  const b = Math.min(255, parseInt(hex.slice(4, 6), 16) + Math.round(255 * amount));
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Helper function to darken a color
function darkenColor(color: string, amount: number): string {
  const hex = color.replace('#', '');
  const r = Math.max(0, parseInt(hex.slice(0, 2), 16) - Math.round(255 * amount));
  const g = Math.max(0, parseInt(hex.slice(2, 4), 16) - Math.round(255 * amount));
  const b = Math.max(0, parseInt(hex.slice(4, 6), 16) - Math.round(255 * amount));
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Helper function to determine if a color is vibrant (suitable for brand use)
function isVibrantColor(color: string): boolean {
  const hex = color.replace('#', '');
  if (hex.length !== 6) return false;
  
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  
  // Calculate saturation and brightness
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  const brightness = max / 255;
  
  // A color is vibrant if it has good saturation and isn't too dark or too light
  return saturation > 0.3 && brightness > 0.2 && brightness < 0.9;
}

// Generate a brand color based on domain/company name
function generateDomainBasedColor(domain: string, companyName?: string): string {
  // Use domain or company name to generate a consistent color
  const text = companyName || domain;
  
  // Create a simple hash from the text
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert hash to a vibrant color
  const hue = Math.abs(hash) % 360;
  const saturation = 65 + (Math.abs(hash) % 25); // 65-90%
  const lightness = 45 + (Math.abs(hash) % 20); // 45-65%
  
  // Convert HSL to hex
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
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Simple workflow to extract website colors and generate a theme proposal
 * This workflow:
 * 1. Extracts colors from the company website
 * 2. Uses AI to analyze and generate a cohesive theme
 * 3. Returns the theme proposal for user approval
 */
export const createOnboardingThemeWorkflow = (env: Bindings) => {
  const extractColorsTool = createExtractWebsiteColorsTool(env);

  console.log("[ONBOARDING_THEME] workflow:initialize");
  
  // Return a simple execution function
  return {
    async execute(input: { domain: string; teamId: string }) {
      console.log("[ONBOARDING_THEME] workflow:start", input);
      
      // Step 1: Extract colors from website
      const extractColorsResult = await extractColorsTool.execute({
        inputData: { domain: input.domain }
      });
      console.log("[ONBOARDING_THEME] extractColors:output", extractColorsResult);
      
      // Step 2: The new extractor returns a complete, consistent theme - use it directly!
      console.log("[ONBOARDING_THEME] using generated theme from AI analysis");
      
      const isDark = extractColorsResult.isDark;
      const extractedTheme = extractColorsResult.colors;
      
      console.log("[ONBOARDING_THEME] theme analysis", {
        isDark,
        primaryColor: extractedTheme['--primary'],
        backgroundLuminance: isDark ? "dark" : "light"
      });
      
      // The new extractor already generates a complete, consistent theme
      const theme = {
        variables: extractedTheme,
        isDark,
      };
      
      const message = `I analyzed ${extractColorsResult.companyName || input.domain}'s brand colors and created a comprehensive ${isDark ? 'dark' : 'light'} theme. The theme uses your primary color (${extractedTheme['--primary']}) as the foundation and includes all shadcn/ui variables for consistent styling. All components will look cohesive with your brand!`;
      
      const generateThemeResult = {
        object: {
          theme,
          message,
        }
      };
      
      console.log("[ONBOARDING_THEME] generateTheme:output", generateThemeResult);
      
      // Step 3: Extract company context for task suggestions
      const companyContext = await extractCompanyContext(input.domain);
      console.log("[ONBOARDING_THEME] extractCompanyContext:output", companyContext);
      
      // Step 4: Combine results
      const result = {
        theme: generateThemeResult.object.theme,
        message: generateThemeResult.object.message,
        companyName: extractColorsResult.companyName,
        favicon: extractColorsResult.favicon,
        logo: extractColorsResult.logo,
        companyContext,
      };
      
      console.log("[ONBOARDING_THEME] workflow:result", result);
      return result;
    }
  };
};

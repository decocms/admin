import type { AppEnv } from "../utils/context.ts";
import { Hono } from "hono";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  processScrapedDataV2,
  mapComponentColorsToTheme,
  extractBestFont,
  type ScrapedSiteData,
  type StylesData,
  type Theme,
  type ExtractedThemeData,
  type ComponentColors,
  validateUrl,
} from "@deco/sdk";

export const themeScraperApp = new Hono<AppEnv>();

interface ScrapeThemeRequest {
  url: string;
}

interface ScrapeThemeResponse {
  success: boolean;
  theme?: Theme;
  components?: ComponentColors; // New: raw component colors
  metadata?: {
    colorsFound: number;
    fontsFound: number;
    elementsAnalyzed: number;
  };
  error?: string;
}

/**
 * Scrape theme from a website URL
 * POST /:org/:project/theme/scrape
 */
const handleThemeScrapeRequest = async (c: Context<AppEnv>) => {
  try {
    const body = await c.req.json<ScrapeThemeRequest>();

    if (!body.url) {
      throw new HTTPException(400, {
        message: "URL is required",
      });
    }

    // Validate URL
    const urlValidation = validateUrl(body.url);
    if (!urlValidation.valid) {
      throw new HTTPException(400, {
        message: urlValidation.error || "Invalid URL",
      });
    }

    console.log(`Scraping theme from: ${body.url}`);

    // Fetch and parse the website
    const scrapedData = await scrapeWebsite(body.url);

    console.log(
      `Scraped data: ${scrapedData.stylesData.length} style elements found`,
    );

    // Process the scraped data into component-grouped colors (V2 approach)
    const extractedData = processScrapedDataV2(scrapedData);

    console.log(
      `Theme extracted: ${extractedData.metadata.colorsFound} colors, ${extractedData.metadata.fontsFound} fonts`,
    );

    // Map component colors to theme variables
    const themeVariables = mapComponentColorsToTheme(extractedData.components);
    const bestFont = extractBestFont(extractedData.fonts);

    // Debug logs for color extraction
    console.log("🎨 Theme Variables Extracted:");
    console.log("  Primary:", themeVariables["--primary"]);
    console.log("  Background:", themeVariables["--background"]);
    console.log("  Foreground:", themeVariables["--foreground"]);
    console.log("  Sidebar:", themeVariables["--sidebar"]);
    console.log("  Sidebar Foreground:", themeVariables["--sidebar-foreground"]);
    
    // Log button colors for debugging primary detection
    const buttonColors = extractedData.components.button || [];
    if (buttonColors.length > 0) {
      console.log("🔘 Button Colors Found:");
      buttonColors.slice(0, 3).forEach((c, i) => {
        console.log(`  [${i + 1}] ${c.color} (${c.type}, score: ${Math.round(c.score || 0)}, sat: ${Math.round((c.saturation || 0) * 100)}%)`);
      });
    }
    
    // Log nav/sidebar colors for debugging
    const navColors = extractedData.components.nav || [];
    if (navColors.length > 0) {
      console.log("🧭 Nav Colors Found:");
      navColors.slice(0, 3).forEach((c, i) => {
        console.log(`  [${i + 1}] ${c.color} (${c.type}, score: ${Math.round(c.score || 0)})`);
      });
    }

    const theme: Theme = {
      variables: {
        ...themeVariables,
        "--radius": "0.375rem", // Always use default
        "--spacing": "0.25rem", // Always use default
      },
      font: bestFont,
    };

    const response: ScrapeThemeResponse = {
      success: true,
      theme,
      components: extractedData.components, // Include raw components for debugging/customization
      metadata: extractedData.metadata,
    };

    return c.json(response);
  } catch (error) {
    console.error("Error scraping theme:", error);

    if (error instanceof HTTPException) {
      throw error;
    }

    // Return a more detailed error response
    const errorMessage = error instanceof Error
      ? error.message
      : "Failed to scrape theme. Please check the URL and try again.";

    const response: ScrapeThemeResponse = {
      success: false,
      error: errorMessage,
    };

    return c.json(response, 500);
  }
};

themeScraperApp.post("/", handleThemeScrapeRequest);

/**
 * Scrape website HTML and extract styles
 * This is a simplified version that works in Cloudflare Workers
 * without requiring browser automation
 */
async function scrapeWebsite(url: string): Promise<ScrapedSiteData> {
  let response: Response;
  
  try {
    // Fetch the HTML
    response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
      },
      // Timeout after 30 seconds
      signal: AbortSignal.timeout(30000),
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "TimeoutError" || error.name === "AbortError") {
        throw new Error("Request timed out. The website took too long to respond.");
      }
      throw new Error(`Failed to fetch website: ${error.message}`);
    }
    throw new Error("Failed to fetch website due to network error");
  }

  if (!response.ok) {
    throw new Error(
      `Failed to fetch URL (${response.status} ${response.statusText}). The website may be down or blocking requests.`,
    );
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    throw new Error(
      `URL did not return HTML content (got ${contentType}). Please provide a valid website URL.`,
    );
  }

  let html: string;
  try {
    html = await response.text();
  } catch (error) {
    throw new Error("Failed to read response content");
  }

  if (!html || html.trim().length === 0) {
    throw new Error("Website returned empty content");
  }

  // Extract styles from HTML
  let stylesData: StylesData[];
  try {
    stylesData = await extractStylesFromHtml(html, url);
  } catch (error) {
    console.error("Error extracting styles:", error);
    throw new Error(
      `Failed to extract styles from website: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }

  if (stylesData.length === 0) {
    throw new Error(
      "No styles found on the website. The page may be empty or heavily rely on JavaScript.",
    );
  }

  return {
    url,
    colors: [],
    fonts: [],
    stylesData,
  };
}

/**
 * Extract styles from HTML string
 * This parses the HTML and extracts computed styles
 */
async function extractStylesFromHtml(
  html: string,
  baseUrl: string,
): Promise<StylesData[]> {
  const stylesData: StylesData[] = [];
  const cssVariables: Record<string, string> = {};

  try {
    // Extract inline styles
    const inlineStylesData = extractInlineStyles(html);
    stylesData.push(...inlineStylesData);

    // Extract stylesheet URLs
    const stylesheetUrls = extractStylesheetUrls(html, baseUrl);

    // Fetch and parse stylesheets (increased limit to 15 for better coverage)
    const maxStylesheets = Math.min(stylesheetUrls.length, 15);
    const stylesheetPromises = stylesheetUrls
      .slice(0, maxStylesheets)
      .map(async (cssUrl) => {
        try {
          const cssData = await fetchAndParseStylesheet(cssUrl, cssVariables);
          return cssData;
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e);
          // Don't log full stack traces for common errors
          if (errorMsg.includes("Maximum call stack")) {
            console.warn(`⚠️ Skipping ${cssUrl.slice(0, 80)}... (recursion issue)`);
          } else {
            console.warn(`⚠️ Failed to fetch stylesheet ${cssUrl.slice(0, 80)}...: ${errorMsg.slice(0, 100)}`);
          }
          return [];
        }
      });

    const stylesheetResults = await Promise.all(stylesheetPromises);
    for (const cssData of stylesheetResults) {
      if (cssData.length > 0) {
        stylesData.push(...cssData);
      }
    }

    // Extract style tags
    const styleTagData = extractStyleTags(html, cssVariables);
    stylesData.push(...styleTagData);

    // Apply CSS variables to expand color values
    resolveVariablesInStyles(stylesData, cssVariables);
  } catch (error) {
    console.error("Error extracting styles:", error);
  }

  return stylesData;
}

/**
 * Extract inline styles from HTML elements
 */
function extractInlineStyles(html: string): StylesData[] {
  const stylesData: StylesData[] = [];

  // Extract inline styles with more context
  const styleRegex = /<(\w+)([^>]*)\sstyle=["']([^"']+)["']/g;
  let match;

  while ((match = styleRegex.exec(html)) !== null) {
    let element = match[1].toLowerCase();
    const attributes = match[2].toLowerCase();
    const styleString = match[3];

    const styles = parseStyleString(styleString);
    
    // Only process if has relevant styles
    if (!hasRelevantStyles(styles)) continue;

    // Treat button-like links and CTAs as buttons
    const ctaIndicators = [
      "button", "btn",
      "cta", "call-to-action",
      "signup", "sign-up", "signin", "sign-in",
      "get-started", "getstarted", "start",
      "demo", "request", "trial",
      "download", "subscribe",
      "primary",
      'role="button"',
      'type="button"'
    ];
    
    if (element === "a" && ctaIndicators.some(indicator => attributes.includes(indicator))) {
      element = "button";
    }

    let importance = getElementImportance(element);
    
    // Boost importance based on element attributes (classes, data attributes, etc)
    if (attributes.includes("primary") || attributes.includes("cta") || 
        attributes.includes("action")) {
      importance *= 2.5;
    }
    if (attributes.includes("button") || attributes.includes("btn")) {
      importance *= 2.0;
    }
    if (attributes.includes("hero") || attributes.includes("highlight")) {
      importance *= 1.8;
    }

    stylesData.push({
      element,
      styles,
      importance,
    });
  }

  return stylesData;
}

/**
 * Extract stylesheet URLs from link tags
 */
function extractStylesheetUrls(html: string, baseUrl: string): string[] {
  const urls: string[] = [];
  const linkRegex =
    /<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    try {
      const absoluteUrl = new URL(href, baseUrl).toString();
      urls.push(absoluteUrl);
    } catch {
      // Skip invalid URLs
    }
  }

  return urls;
}

/**
 * Extract styles from <style> tags
 */
function extractStyleTags(html: string, cssVariables: Record<string, string>): StylesData[] {
  const stylesData: StylesData[] = [];
  const styleTagRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let match;

  while ((match = styleTagRegex.exec(html)) !== null) {
    const cssText = match[1];
    extractCssVariables(cssText, cssVariables);
    const parsed = parseCssRules(cssText);
    stylesData.push(...parsed);
  }

  return stylesData;
}

/**
 * Fetch and parse external stylesheet
 */
async function fetchAndParseStylesheet(url: string, cssVariables: Record<string, string>): Promise<StylesData[]> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/css,*/*;q=0.1",
      },
      signal: AbortSignal.timeout(10000), // Increased timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (
      !contentType.includes("text/css") && !contentType.includes("text/plain")
    ) {
      console.warn(
        `Stylesheet ${url} has unexpected content-type: ${contentType}`,
      );
    }

    const cssText = await response.text();

    if (!cssText || cssText.trim().length === 0) {
      console.warn(`Stylesheet ${url} is empty`);
      return [];
    }

    // Extract CSS variables first
    extractCssVariables(cssText, cssVariables);
    
    return parseCssRules(cssText);
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "TimeoutError" || error.name === "AbortError") {
        throw new Error(`Timeout fetching stylesheet from ${url}`);
      }
      throw new Error(`Failed to fetch ${url}: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Check if selector is from code/syntax highlighting elements
 */
function isCodeEditorSelector(selector: string): boolean {
  const codePatterns = [
    'code', 'pre', 'syntax', 'editor', 'highlight',
    'ch-', 'shiki-', 'prism-', 'hljs-', 'token-',
    'monaco-', 'codemirror-', 'ace-'
  ];
  
  const lowerSelector = selector.toLowerCase();
  return codePatterns.some(pattern => lowerSelector.includes(pattern));
}

/**
 * Parse CSS rules and extract styles
 */
function parseCssRules(cssText: string): StylesData[] {
  const stylesData: StylesData[] = [];

  // Remove comments first
  cssText = cssText.replace(/\/\*[\s\S]*?\*\//g, '');

  // Simple CSS parser - matches selector { properties }
  const ruleRegex = /([^{]+)\{([^}]+)\}/g;
  let match;

  while ((match = ruleRegex.exec(cssText)) !== null) {
    const selector = match[1].trim();
    const properties = match[2];

    // Skip media queries, keyframes, supports, etc
    if (selector.startsWith("@")) continue;
    
    // Skip pseudo-elements that don't contribute to theme
    if (selector.includes("::before") || selector.includes("::after") ||
        selector.includes("::placeholder")) continue;

    // Skip code editor and syntax highlighting elements
    if (isCodeEditorSelector(selector)) continue;

    const element = extractElementFromSelector(selector);
    const styles = parseStyleString(properties);

    // Only include if we have relevant style properties
    if (hasRelevantStyles(styles)) {
      // Boost importance for key UI elements
      let importance = getElementImportance(element);
      
      // Massive boost for CTA and primary elements
      const selectorLower = selector.toLowerCase();
      
      // Super high priority for primary/CTA buttons and links
      if (selectorLower.includes("primary") || selectorLower.includes("cta") || 
          selectorLower.includes("action") || selectorLower.includes("hero")) {
        importance *= 3.0;
      }
      
      // High priority for buttons
      if (selectorLower.includes("button") || selectorLower.includes("btn")) {
        importance *= 2.0;
      }
      
      // Medium priority for navigation elements
      if (selectorLower.includes("nav") || selectorLower.includes("header")) {
        importance *= 1.5;
      }
      
      // Boost for brand/logo elements
      if (selectorLower.includes("brand") || selectorLower.includes("logo")) {
        importance *= 1.8;
      }

      stylesData.push({
        element,
        styles,
        importance,
      });
    }
  }

  return stylesData;
}

/**
 * Parse style string into object
 */
function parseStyleString(styleString: string): Record<string, string> {
  const styles: Record<string, string> = {};

  const declarations = styleString.split(";");
  for (const decl of declarations) {
    const [property, value] = decl.split(":").map((s) => s.trim());
    if (property && value) {
      // Convert kebab-case to camelCase
      const camelProperty = property.replace(/-([a-z])/g, (g) =>
        g[1].toUpperCase(),
      );
      styles[camelProperty] = value;
    }
  }

  return styles;
}

/**
 * Extract element type from CSS selector
 */
function extractElementFromSelector(selector: string): string {
  const lowerSelector = selector.toLowerCase();
  
  // Remove pseudo-classes and pseudo-elements
  const cleanSelector = selector.replace(/::?[a-z-]+/g, "");

  // Extract element name if selector starts with an element
  const elementMatch = cleanSelector.match(/^([a-z][a-z0-9]*)/i);
  let element = elementMatch ? elementMatch[1].toLowerCase() : null;

  // Special case: if it's an <a> with button/CTA classes, treat as button
  const ctaPatterns = [
    "button", "btn",
    "cta", "call-to-action",
    "signup", "sign-up", "signin", "sign-in",
    "get-started", "getstarted", "start",
    "demo", "request", "trial"
  ];
  
  if (element === "a" && ctaPatterns.some(pattern => lowerSelector.includes(pattern))) {
    return "button";
  }

  // If we found an element tag, return it
  if (element) {
    return element;
  }

  // Check for semantic element classes (higher priority)
  if (lowerSelector.includes("button") || lowerSelector.includes("btn")) return "button";
  if (lowerSelector.includes("link") || lowerSelector.includes("anchor")) return "a";
  if (lowerSelector.includes("nav") || lowerSelector.includes("navigation")) return "nav";
  if (lowerSelector.includes("header")) return "header";
  if (lowerSelector.includes("footer")) return "footer";
  if (lowerSelector.includes("sidebar") || lowerSelector.includes("aside")) return "aside";
  if (lowerSelector.includes("main") || lowerSelector.includes("content")) return "main";
  
  // Check for heading patterns
  if (lowerSelector.includes("heading") || lowerSelector.includes("title")) {
    if (lowerSelector.includes("h1") || lowerSelector.includes("primary")) return "h1";
    if (lowerSelector.includes("h2") || lowerSelector.includes("secondary")) return "h2";
    return "h3";
  }

  // Check for UI component patterns
  if (lowerSelector.includes("card")) return "div";
  if (lowerSelector.includes("modal") || lowerSelector.includes("dialog")) return "div";
  if (lowerSelector.includes("dropdown") || lowerSelector.includes("menu")) return "nav";
  if (lowerSelector.includes("badge") || lowerSelector.includes("tag")) return "span";
  if (lowerSelector.includes("body")) return "body";

  return "div"; // Default
}

/**
 * Check if styles object has relevant properties for theme extraction
 */
function hasRelevantStyles(styles: Record<string, string>): boolean {
  const relevantProps = [
    "backgroundColor",
    "background",
    "color",
    "borderColor",
    "borderTopColor",
    "borderRightColor",
    "borderBottomColor",
    "borderLeftColor",
    "borderRadius",
    "outlineColor",
    "accentColor",
    "fill",
    "stroke",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "gap",
    "gridGap",
    "padding",
    "margin",
    "boxShadow",
    "textDecoration",
    "lineHeight",
    "letterSpacing",
  ];

  return relevantProps.some((prop) => prop in styles);
}

/**
 * Get element importance score for theme extraction
 */
function getElementImportance(element: string): number {
  const importance: Record<string, number> = {
    button: 1.0,
    a: 0.9,
    nav: 0.9,
    header: 0.8,
    h1: 0.8,
    h2: 0.7,
    h3: 0.6,
    body: 0.9,
    main: 0.7,
    aside: 0.5,
    footer: 0.4,
    div: 0.3,
    span: 0.2,
  };

  return importance[element.toLowerCase()] || 0.3;
}

/**
 * Extract CSS variables from CSS text (improved recursive resolution)
 */
function extractCssVariables(
  cssText: string,
  variables: Record<string, string>,
): void {
  // First pass: collect all variable definitions
  const tempVars: Record<string, string> = {};
  
  // Match :root or * selector with CSS variables (highest priority)
  const rootRegex = /(:root|\*)\s*\{([^}]+)\}/g;
  let rootMatch;

  while ((rootMatch = rootRegex.exec(cssText)) !== null) {
    const properties = rootMatch[2];
    const varRegex = /--([\w-]+)\s*:\s*([^;]+);/g;
    let varMatch;

    while ((varMatch = varRegex.exec(properties)) !== null) {
      const varName = `--${varMatch[1]}`;
      const varValue = varMatch[2].trim();
      tempVars[varName] = varValue;
    }
  }

  // Second pass: look for CSS variables in any selector
  const anyVarRegex = /--([\w-]+)\s*:\s*([^;]+);/g;
  let anyMatch;

  while ((anyMatch = anyVarRegex.exec(cssText)) !== null) {
    const varName = `--${anyMatch[1]}`;
    const varValue = anyMatch[2].trim();
    
    // Only add if not already defined (prefer :root definitions)
    if (!tempVars[varName]) {
      tempVars[varName] = varValue;
    }
  }
  
  // Third pass: resolve nested variables recursively (with safety)
  const maxIterations = 5; // Reduced to prevent issues
  let changesMade = true;
  
  for (let i = 0; i < maxIterations && changesMade; i++) {
    changesMade = false;
    
    for (const [varName, varValue] of Object.entries(tempVars)) {
      if (varValue.includes("var(")) {
        try {
          const resolved = resolveCssVariable(varValue, tempVars, 0);
          if (resolved !== varValue && !resolved.includes("var(")) {
            tempVars[varName] = resolved;
            changesMade = true;
          }
        } catch (e) {
          // Skip problematic variables
          console.warn(`Failed to resolve ${varName}:`, e);
        }
      }
    }
  }
  
  // Merge into main variables object
  Object.assign(variables, tempVars);
}

/**
 * Resolve CSS variable references in style values
 */
function resolveVariablesInStyles(
  stylesData: StylesData[],
  variables: Record<string, string>,
): void {
  for (const styleData of stylesData) {
    for (const [prop, value] of Object.entries(styleData.styles)) {
      if (typeof value === "string" && value.includes("var(")) {
        try {
          const resolved = resolveCssVariable(value, variables, 0);
          if (resolved !== value && !resolved.includes("var(")) {
            styleData.styles[prop] = resolved;
          }
        } catch (e) {
          // Keep original value if resolution fails
        }
      }
    }
  }
}

/**
 * Resolve a CSS variable reference (with stack overflow protection)
 */
function resolveCssVariable(
  value: string,
  variables: Record<string, string>,
  depth = 0,
): string {
  // Prevent infinite recursion
  if (depth > 10) {
    return value;
  }
  
  // Match var(--variable-name, fallback)
  const varRegex = /var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/g;
  
  return value.replace(varRegex, (match, varName, fallback) => {
    const resolved = variables[varName];
    
    if (resolved) {
      // Recursively resolve nested variables with depth tracking
      if (resolved.includes("var(")) {
        return resolveCssVariable(resolved, variables, depth + 1);
      }
      return resolved;
    }
    
    // Use fallback if provided
    if (fallback) {
      return fallback.trim();
    }
    
    return match; // Return original if can't resolve
  });
}

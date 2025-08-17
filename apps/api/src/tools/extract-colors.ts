import { z } from "zod";
import type { Bindings } from "../utils/context.ts";

// TEST DOMAIN - Change this to test different websites (set to null to disable)
const TEST_DOMAIN = null; // Set to null for production use

/**
 * Tool to extract colors from a website
 * Fetches the website and extracts theme colors from various sources
 */
export const createExtractWebsiteColorsTool = (env: Bindings) =>
  createTool({
    id: "EXTRACT_WEBSITE_COLORS",
    description: "Extract theme colors from a company website",
    inputSchema: z.object({
      domain: z.string().describe("The domain to extract colors from (e.g., deco.cx)"),
    }),
    outputSchema: z.object({
      colors: z.record(z.string()), // CSS variables like --primary, --background, etc.
      isDark: z.boolean().optional(),
      favicon: z.string().optional(),
      logo: z.string().optional(),
      companyName: z.string().optional(),
    }),
    execute: async ({ inputData }) => {
      const { domain } = inputData;
      
      // Use TEST_DOMAIN for testing, or the provided domain
      const testDomain = TEST_DOMAIN ? TEST_DOMAIN : domain;
      console.log(`[extractColors] Using domain: ${testDomain} (original: ${domain})`);
      
      try {
                 // Fetch the website HTML with better headers
        const response = await fetch(`https://${testDomain}`, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate, br",
            "DNT": "1",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
          },
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch website: ${response.status}`);
        }
        
                 const html = await response.text();
        
        // Initialize color extraction results
        const extractionResults = {
          colors: {} as Record<string, string>,
          favicon: undefined as string | undefined,
          logo: undefined as string | undefined,
          companyName: undefined as string | undefined,
        };

        // Use HTMLRewriter-like approach for better parsing
                 const colorExtractor = new BrandColorExtractor(domain, html, env);
         const extractedColors = await colorExtractor.extractColors();

         extractionResults.colors = extractedColors;
         extractionResults.isDark = colorExtractor.detectDarkMode();
         
         // Extract additional metadata
         extractionResults.favicon = extractFavicon(html, domain);
         extractionResults.logo = extractLogo(html, domain);
         extractionResults.companyName = extractCompanyName(html);
        
        return extractionResults;
      } catch (error) {
        console.error("Error extracting website colors:", error);
        
        // Return default colors on error
        return {
          colors: {
            primary: "#292524",
            secondary: "#78716c",
            accent: "#d0ec1a",
            background: "#ffffff",
            foreground: "#292524",
          },
        };
      }
    },
  });

/**
 * Advanced brand color extractor class
 */
class BrandColorExtractor {
  private domain: string;
  private html: string;
  private env: Bindings;
  private methodsUsed: string[] = [];

  constructor(domain: string, html: string, env: Bindings) {
    this.domain = domain;
    this.html = html;
    this.env = env;
  }

     async extractColors(): Promise<Record<string, string>> {
     // Step 1: Extract ALL possible colors from the website
     const allExtractedColors = await this.extractAllColorsFromWebsite();
     
     console.groupCollapsed("[STEP 1] Extract All Colors");
     // console.log("Input:", { domain: this.domain });
     // console.log("Output:", { 
     //   totalColors: Object.keys(allExtractedColors).length,
     //   colors: allExtractedColors 
     // });
     console.groupEnd();

     // Step 2: First LLM - Analyze and categorize all colors
     const categorizedColors = await this.categorizeColorsWithLLM(allExtractedColors);
     
     console.groupCollapsed("[STEP 2] LLM Color Categorization");
     // console.log("Input:", { 
     //   totalColors: Object.keys(allExtractedColors).length,
     //   topColors: Object.values(allExtractedColors)
     //     .sort((a, b) => b.frequency - a.frequency)
     //     .slice(0, 10)
     //     .map(c => ({ color: c.color, frequency: c.frequency, contexts: c.contexts }))
     // });
     // console.log("Output:", categorizedColors);
     console.groupEnd();

     // Step 3: Second LLM - Generate consistent theme using our theme tokens
     const finalTheme = await this.generateThemeWithLLM(categorizedColors);
     
     console.groupCollapsed("[STEP 3] LLM Theme Generation");
     // console.log("Input:", categorizedColors);
     // console.log("Output:", finalTheme);
     console.groupEnd();

     return finalTheme;
   }





  private async callOpenAI(prompt: string): Promise<any> {
    // Get OpenAI API key from environment
    const apiKey = this.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY not available");
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Use the fast, cost-effective model
        messages: [
          {
            role: 'system',
            content: 'You are an expert web designer and brand color analyst. You excel at identifying brand colors from website HTML.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1, // Low temperature for consistent results
        max_tokens: 500,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No content in OpenAI response");
    }

    return JSON.parse(content);
  }

  private extractMetaThemeColor(colors: Record<string, string>): void {
    const themeColorMatch = this.html.match(/<meta\s+name=["']theme-color["']\s+content=["']([^"']+)["']/i);
    if (themeColorMatch && isValidColor(themeColorMatch[1])) {
      colors.primary = themeColorMatch[1];
      this.methodsUsed.push('meta-theme-color');
      console.log("[BRAND_EXTRACTOR] Meta theme-color found", { primary: colors.primary });
    }
  }

  private extractSpecificBrandPatterns(colors: Record<string, string>): void {
    if (colors.primary) return; // Already found
    
    // Look for specific patterns that are likely to contain brand colors
    const brandPatterns = [
      // GitHub specific - look for success/action colors in buttons and links
      /<a[^>]*class="[^"]*(?:btn-primary|Button--primary)[^"]*"[^>]*>/gi,
      /<button[^>]*class="[^"]*(?:btn-primary|Button--primary)[^"]*"[^>]*>/gi,
      // Look for CTA buttons with vibrant colors
      /<(?:a|button)[^>]*class="[^"]*(?:cta|call-to-action|primary|brand)[^"]*"[^>]*>/gi,
      // Look for logo containers
      /<[^>]*class="[^"]*logo[^"]*"[^>]*>/gi,
      // Look for header/nav with brand colors
      /<(?:header|nav)[^>]*class="[^"]*(?:primary|brand)[^"]*"[^>]*>/gi,
    ];

    const contextualColors: Array<{color: string, context: string, priority: number}> = [];

    for (const pattern of brandPatterns) {
      const matches = this.html.match(pattern) || [];
      for (const match of matches) {
        // Look for colors in the vicinity of these elements
        const matchIndex = this.html.indexOf(match);
        const surroundingContext = this.html.substring(
          Math.max(0, matchIndex - 500), 
          Math.min(this.html.length, matchIndex + match.length + 500)
        );

        // Extract colors from this context
        const hexColors = surroundingContext.match(/#[0-9a-fA-F]{3,6}/g) || [];
        const rgbColors = surroundingContext.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g) || [];

        // Process hex colors
        for (const hexColor of hexColors) {
          let normalizedColor = hexColor.toLowerCase();
          if (normalizedColor.length === 4) {
            normalizedColor = `#${normalizedColor[1]}${normalizedColor[1]}${normalizedColor[2]}${normalizedColor[2]}${normalizedColor[3]}${normalizedColor[3]}`;
          }
          
          if (isVibrantColor(normalizedColor) && !isCommonNeutral(normalizedColor)) {
            let priority = 1;
            const lowerMatch = match.toLowerCase();
            if (lowerMatch.includes('btn-primary') || lowerMatch.includes('button--primary')) priority = 5;
            else if (lowerMatch.includes('cta') || lowerMatch.includes('call-to-action')) priority = 4;
            else if (lowerMatch.includes('logo')) priority = 4;
            else if (lowerMatch.includes('primary') || lowerMatch.includes('brand')) priority = 3;
            
            contextualColors.push({
              color: normalizedColor,
              context: match.substring(0, 100),
              priority
            });
          }
        }

        // Process RGB colors
        for (const rgbColor of rgbColors) {
          const rgbMatch = rgbColor.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
          if (rgbMatch) {
            const r = parseInt(rgbMatch[1]);
            const g = parseInt(rgbMatch[2]);
            const b = parseInt(rgbMatch[3]);
            const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
            
            if (isVibrantColor(hex) && !isCommonNeutral(hex)) {
              let priority = 1;
              const lowerMatch = match.toLowerCase();
              if (lowerMatch.includes('btn-primary') || lowerMatch.includes('button--primary')) priority = 5;
              else if (lowerMatch.includes('cta') || lowerMatch.includes('call-to-action')) priority = 4;
              else if (lowerMatch.includes('logo')) priority = 4;
              else if (lowerMatch.includes('primary') || lowerMatch.includes('brand')) priority = 3;
              
              contextualColors.push({
                color: hex,
                context: match.substring(0, 100),
                priority
              });
            }
          }
        }
      }
    }

    // Also look for specific link colors (often brand colors)
    const linkColorMatches = this.html.match(/<a[^>]*style="[^"]*color:\s*([^;"']+)[^"]*"[^>]*>/gi) || [];
    for (const linkMatch of linkColorMatches) {
      const colorMatch = linkMatch.match(/color:\s*([^;"']+)/);
      if (colorMatch) {
        const color = colorMatch[1].trim();
        if (isValidColor(color)) {
          let hexColor = color;
          
          // Convert RGB to hex if needed
          if (color.startsWith('rgb')) {
            const rgbMatch = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
            if (rgbMatch) {
              const r = parseInt(rgbMatch[1]);
              const g = parseInt(rgbMatch[2]);
              const b = parseInt(rgbMatch[3]);
              hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
            }
          }
          
          if (isVibrantColor(hexColor) && !isCommonNeutral(hexColor)) {
            contextualColors.push({
              color: hexColor,
              context: 'link-color',
              priority: 3
            });
          }
        }
      }
    }

    // Sort by priority and select the best candidate
    if (contextualColors.length > 0) {
      contextualColors.sort((a, b) => b.priority - a.priority);
      colors.primary = contextualColors[0].color;
      this.methodsUsed.push('specific-brand-patterns');
      console.log("[BRAND_EXTRACTOR] Specific brand pattern found", {
        primary: colors.primary,
        priority: contextualColors[0].priority,
        context: contextualColors[0].context,
        totalCandidates: contextualColors.length
      });
    }
  }

  private extractSvgFillColors(colors: Record<string, string>): void {
    if (colors.primary) return; // Already found a primary color
    
    // Look for SVGs in brand-related contexts first
    const brandSvgPatterns = [
      // Logo SVGs
      /<svg[^>]*class="[^"]*logo[^"]*"[^>]*>[\s\S]*?<\/svg>/gi,
      // Brand/primary SVGs
      /<svg[^>]*class="[^"]*(?:brand|primary)[^"]*"[^>]*>[\s\S]*?<\/svg>/gi,
      // Header/nav SVGs
      /<(?:header|nav)[^>]*>[\s\S]*?<svg[^>]*>[\s\S]*?<\/svg>[\s\S]*?<\/(?:header|nav)>/gi,
    ];

    const contextualSvgColors: Array<{color: string, context: string, priority: number}> = [];

    // First, look for SVGs in brand contexts
    for (const pattern of brandSvgPatterns) {
      const matches = this.html.match(pattern) || [];
      for (const svgMatch of matches) {
        const fillMatches = svgMatch.match(/fill=["']#[0-9a-fA-F]{3,6}["']/gi) || [];
        
        for (const fillMatch of fillMatches) {
          const colorMatch = fillMatch.match(/#[0-9a-fA-F]{3,6}/);
          if (colorMatch) {
            let color = colorMatch[0].toLowerCase();
            
            // Convert 3-digit to 6-digit hex
            if (color.length === 4) {
              color = `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
            }
            
            if (isVibrantColor(color) && !isCommonNeutral(color)) {
              let priority = 1;
              const lowerSvg = svgMatch.toLowerCase();
              if (lowerSvg.includes('logo')) priority = 5;
              else if (lowerSvg.includes('brand') || lowerSvg.includes('primary')) priority = 4;
              else if (lowerSvg.includes('header') || lowerSvg.includes('nav')) priority = 3;
              
              contextualSvgColors.push({
                color,
                context: 'brand-svg',
                priority
              });
            }
          }
        }
      }
    }

    // If no brand SVGs found, look at all SVG fills but be more selective
    if (contextualSvgColors.length === 0) {
      const allSvgFillMatches = this.html.match(/fill=["']#[0-9a-fA-F]{3,6}["']/gi) || [];
      const colorCounts: Record<string, number> = {};
      
      for (const fillMatch of allSvgFillMatches) {
        const colorMatch = fillMatch.match(/#[0-9a-fA-F]{3,6}/);
        if (colorMatch) {
          let color = colorMatch[0].toLowerCase();
          
          // Convert 3-digit to 6-digit hex
          if (color.length === 4) {
            color = `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
          }
          
          if (isVibrantColor(color) && !isCommonNeutral(color)) {
            colorCounts[color] = (colorCounts[color] || 0) + 1;
          }
        }
      }
      
      // Only consider colors that appear multiple times (likely brand colors)
      const frequentColors = Object.entries(colorCounts)
        .filter(([, count]) => count >= 2)
        .sort(([,a], [,b]) => b - a);
      
      if (frequentColors.length > 0) {
        contextualSvgColors.push({
          color: frequentColors[0][0],
          context: 'frequent-svg',
          priority: 2
        });
      }
    }

    // Select the best SVG color
    if (contextualSvgColors.length > 0) {
      contextualSvgColors.sort((a, b) => b.priority - a.priority);
      colors.primary = contextualSvgColors[0].color;
      this.methodsUsed.push('svg-fill');
      console.log("[BRAND_EXTRACTOR] SVG fill brand color found", { 
        primary: colors.primary, 
        priority: contextualSvgColors[0].priority,
        context: contextualSvgColors[0].context,
        totalCandidates: contextualSvgColors.length
      });
    }
  }

  private async extractCssCustomProperties(colors: Record<string, string>): Promise<void> {
    // Extract CSS file URLs
    const cssLinks = this.html.match(/href=["']([^"']*\.css[^"']*)["']/g) || [];
    const cssUrls: string[] = [];

    for (const link of cssLinks.slice(0, 3)) { // Limit to first 3 CSS files for performance
      const urlMatch = link.match(/href=["']([^"']+)["']/);
      if (urlMatch) {
        let cssUrl = urlMatch[1];
        // Convert relative URLs to absolute
        if (cssUrl.startsWith('//')) {
          cssUrl = `https:${cssUrl}`;
        } else if (cssUrl.startsWith('/')) {
          cssUrl = `https://${this.domain}${cssUrl}`;
        } else if (!cssUrl.startsWith('http')) {
          cssUrl = `https://${this.domain}/${cssUrl}`;
        }
        cssUrls.push(cssUrl);
      }
    }

    // Fetch and analyze CSS files
    for (const cssUrl of cssUrls) {
      try {
        const cssResponse = await fetch(cssUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        });

        if (cssResponse.ok) {
          const cssText = await cssResponse.text();
          this.analyzeCssForBrandColors(cssText, colors);
          
          if (colors.primary) {
            this.methodsUsed.push('css-custom-properties');
            break; // Stop once we find a good primary color
          }
        }
      } catch (error) {
        console.log("[BRAND_EXTRACTOR] CSS fetch error", { cssUrl, error: String(error) });
      }
    }
  }

  private analyzeCssForBrandColors(cssText: string, colors: Record<string, string>): void {
    // High priority patterns for brand colors
    const brandPatterns = [
      // CSS custom properties with brand-related names (more comprehensive)
      /--[a-zA-Z0-9-_]*(?:brand|primary|main|logo|accent|success|green)[a-zA-Z0-9-_]*\s*:\s*(#[0-9a-fA-F]{3,6})/gi,
      // Button and CTA colors (including success/action buttons)
      /\.(?:btn|button|cta)[-_]?(?:primary|success|action|brand)?[^{]*\{[^}]*(?:background-color|background)\s*:\s*(#[0-9a-fA-F]{3,6})/gi,
      // Header and navigation colors
      /\.(?:header|nav|navbar|brand|logo)[^{]*\{[^}]*(?:background-color|color)\s*:\s*(#[0-9a-fA-F]{3,6})/gi,
      // GitHub-specific patterns
      /\.(?:color-fg-success|text-green|bg-success)[^{]*\{[^}]*(?:color|background-color)\s*:\s*(#[0-9a-fA-F]{3,6})/gi,
      // deco.cx specific patterns
      /\.(?:bg-primary|text-primary|accent)[^{]*\{[^}]*(?:background-color|color)\s*:\s*(#[0-9a-fA-F]{3,6})/gi,
      // Generic success/action colors
      /\.(?:success|action|positive|confirm)[^{]*\{[^}]*(?:background-color|color)\s*:\s*(#[0-9a-fA-F]{3,6})/gi,
    ];

    const foundColors: Array<{color: string, context: string, priority: number}> = [];

    for (const pattern of brandPatterns) {
      const matches = cssText.match(pattern) || [];
      for (const match of matches) {
        const colorMatch = match.match(/#[0-9a-fA-F]{3,6}/);
        if (colorMatch) {
          let color = colorMatch[0].toLowerCase();
          
          // Convert 3-digit hex to 6-digit
          if (color.length === 4) {
            color = `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
          }
          
          if (isVibrantColor(color) && !isCommonNeutral(color)) {
            // Assign priority based on context
            let priority = 1;
            const lowerMatch = match.toLowerCase();
            if (lowerMatch.includes('brand') || lowerMatch.includes('primary')) priority = 5;
            else if (lowerMatch.includes('success') || lowerMatch.includes('action')) priority = 4;
            else if (lowerMatch.includes('logo') || lowerMatch.includes('main')) priority = 3;
            else if (lowerMatch.includes('accent') || lowerMatch.includes('cta')) priority = 2;
            
            foundColors.push({
              color,
              context: match.substring(0, 80),
              priority
            });
          }
        }
      }
    }

    // Sort by priority and pick the best
    if (foundColors.length > 0 && !colors.primary) {
      foundColors.sort((a, b) => b.priority - a.priority);
      colors.primary = foundColors[0].color;
      console.log("[BRAND_EXTRACTOR] CSS brand pattern found", { 
        primary: colors.primary, 
        priority: foundColors[0].priority,
        context: foundColors[0].context,
        totalCandidates: foundColors.length
      });
    }
  }

  private extractFrequentBrandColors(colors: Record<string, string>): void {
    // Extract all hex colors (including 3-digit) and analyze frequency with context weighting
    const allHexColors = [
      ...(this.html.match(/#[0-9a-fA-F]{6}/g) || []),
      ...(this.html.match(/#[0-9a-fA-F]{3}/g) || [])
    ];
    
    const colorFrequency: Record<string, number> = {};
    const contextWeights: Record<string, number> = {};

    // Count frequency and analyze context
    for (const color of allHexColors) {
      let normalizedColor = color.toLowerCase();
      
      // Convert 3-digit hex to 6-digit
      if (normalizedColor.length === 4) {
        normalizedColor = `#${normalizedColor[1]}${normalizedColor[1]}${normalizedColor[2]}${normalizedColor[2]}${normalizedColor[3]}${normalizedColor[3]}`;
      }
      
      colorFrequency[normalizedColor] = (colorFrequency[normalizedColor] || 0) + 1;
      
      // Check context around the color for brand-related elements
      const colorIndex = this.html.indexOf(color);
      const context = this.html.substring(Math.max(0, colorIndex - 300), colorIndex + 300).toLowerCase();
      
      let weight = 1;
      
      // High priority contexts
      if (context.includes('logo') || context.includes('brand')) weight += 5;
      if (context.includes('primary') || context.includes('main')) weight += 4;
      
      // Medium priority contexts
      if (context.includes('header') || context.includes('nav')) weight += 3;
      if (context.includes('button') || context.includes('cta')) weight += 3;
      if (context.includes('svg') || context.includes('fill')) weight += 3;
      if (context.includes('success') || context.includes('action')) weight += 3;
      
      // GitHub specific
      if (context.includes('color-fg-success') || context.includes('text-green')) weight += 4;
      
      // deco.cx specific  
      if (context.includes('bg-primary') || context.includes('accent')) weight += 4;
      
      // Link colors (often brand colors)
      if (context.includes('<a ') || context.includes('link')) weight += 2;
      
      contextWeights[normalizedColor] = Math.max(contextWeights[normalizedColor] || 0, weight);
    }

    // Find the best brand color candidate (lower threshold for frequency)
    const brandCandidates = Object.entries(colorFrequency)
      .filter(([color, count]) => {
        // Lower threshold - even single occurrence with high context weight
        const weight = contextWeights[color] || 1;
        return (count >= 1 && weight >= 3) || (count >= 2) && isVibrantColor(color) && !isCommonNeutral(color);
      })
      .map(([color, count]) => ({
        color,
        count,
        weight: contextWeights[color] || 1,
        score: count * (contextWeights[color] || 1)
      }))
      .sort((a, b) => b.score - a.score);

    if (brandCandidates.length > 0 && !colors.primary) {
      colors.primary = brandCandidates[0].color;
      this.methodsUsed.push('weighted-frequency');
      console.log("[BRAND_EXTRACTOR] Weighted frequency brand color found", {
        primary: colors.primary,
        count: brandCandidates[0].count,
        weight: brandCandidates[0].weight,
        score: brandCandidates[0].score,
        topCandidates: brandCandidates.slice(0, 5).map(c => ({
          color: c.color,
          score: c.score
        }))
      });
    }
  }

  private extractBrandSelectors(colors: Record<string, string>): void {
    // Extract colors from CSS in style blocks
    const styleBlocks = this.html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
    const allCssText = styleBlocks.join('\n');

    const brandSelectors = [
      /\.(?:btn|button)[-_]?(?:primary|main|brand|cta)[^{]*\{[^}]*(?:background-color|background)\s*:\s*(#[0-9a-fA-F]{6})/gi,
      /\.(?:header|nav|navbar|brand|logo)[^{]*\{[^}]*(?:background-color|color)\s*:\s*(#[0-9a-fA-F]{6})/gi,
      /\.(?:primary|brand|main)[^{]*\{[^}]*(?:background-color|color)\s*:\s*(#[0-9a-fA-F]{6})/gi,
    ];

    for (const selectorPattern of brandSelectors) {
      const matches = allCssText.match(selectorPattern) || [];
      for (const match of matches) {
        const colorMatch = match.match(/#[0-9a-fA-F]{6}/);
        if (colorMatch) {
          const color = colorMatch[0].toLowerCase();
          if (isVibrantColor(color) && !colors.primary) {
            colors.primary = color;
            this.methodsUsed.push('brand-selectors');
            console.log("[BRAND_EXTRACTOR] Brand selector color found", { 
              primary: colors.primary, 
              selector: match.substring(0, 50) + '...' 
            });
            return;
          }
        }
      }
    }
  }

  private extractInlineStyles(colors: Record<string, string>): void {
    const inlineStyleMatches = this.html.match(/style=["'][^"']*(?:background-color|color)\s*:\s*#[0-9a-fA-F]{6}[^"']*["']/gi) || [];
    
    for (const styleMatch of inlineStyleMatches) {
      const colorMatch = styleMatch.match(/#[0-9a-fA-F]{6}/);
      if (colorMatch) {
        const color = colorMatch[0].toLowerCase();
        if (isVibrantColor(color) && !isCommonNeutral(color) && !colors.primary) {
          colors.primary = color;
          this.methodsUsed.push('inline-styles');
          console.log("[BRAND_EXTRACTOR] Inline style brand color found", { primary: colors.primary });
          return;
        }
      }
    }
  }

  private extractScriptColors(colors: Record<string, string>): void {
    const scriptTags = this.html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
    
    for (const scriptTag of scriptTags) {
      // Look for color definitions in JavaScript/CSS-in-JS
      const colorInJsMatches = scriptTag.match(/(?:primary|brand|main|accent)["']?\s*:\s*["']([#][0-9a-fA-F]{6})["']/gi) || [];
      
      for (const match of colorInJsMatches) {
        const colorMatch = match.match(/["']([#][0-9a-fA-F]{6})["']/);
        if (colorMatch) {
          const color = colorMatch[1].toLowerCase();
          if (isVibrantColor(color) && !colors.primary) {
            colors.primary = color;
            this.methodsUsed.push('css-in-js');
            console.log("[BRAND_EXTRACTOR] CSS-in-JS brand color found", { primary: colors.primary });
            return;
          }
        }
      }
    }
  }

  private extractRgbHslColors(colors: Record<string, string>): void {
    if (colors.primary) return; // Already found a primary color
    
    // Extract RGB colors from CSS and convert to hex
    const rgbMatches = this.html.match(/(?:background-color|color)\s*:\s*rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/gi) || [];
    const brandRgbColors: Array<{color: string, context: string}> = [];
    
    for (const match of rgbMatches) {
      const rgbMatch = match.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
      if (rgbMatch) {
        const r = parseInt(rgbMatch[1]);
        const g = parseInt(rgbMatch[2]);
        const b = parseInt(rgbMatch[3]);
        
        // Convert to hex
        const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        
        if (isVibrantColor(hex) && !isCommonNeutral(hex)) {
          // Check context for brand relevance
          const matchIndex = this.html.indexOf(match);
          const context = this.html.substring(Math.max(0, matchIndex - 200), matchIndex + 200).toLowerCase();
          
          let priority = 0;
          if (context.includes('brand') || context.includes('primary')) priority += 5;
          if (context.includes('logo') || context.includes('main')) priority += 4;
          if (context.includes('button') || context.includes('cta')) priority += 3;
          if (context.includes('success') || context.includes('action')) priority += 3;
          
          if (priority > 0) {
            brandRgbColors.push({ color: hex, context: match });
          }
        }
      }
    }
    
    if (brandRgbColors.length > 0) {
      colors.primary = brandRgbColors[0].color;
      this.methodsUsed.push('rgb-conversion');
      console.log("[BRAND_EXTRACTOR] RGB brand color found and converted", { 
        primary: colors.primary,
        originalRgb: brandRgbColors[0].context
      });
    }
  }

  private setDefaultColors(colors: Record<string, string>): void {
    // Enhanced dark mode detection
    const isDarkMode = this.detectDarkMode();

    // Set background and foreground defaults if not found
    if (!colors.background) {
      colors.background = isDarkMode ? "#0f0f0f" : "#ffffff";
    }
    if (!colors.foreground) {
      colors.foreground = isDarkMode ? "#ffffff" : "#292524";
    }
  }

  detectDarkMode(): boolean {
    const html = this.html.toLowerCase();
    
    // Check for explicit dark mode indicators
    const darkModeIndicators = [
      'data-theme="dark"',
      'class="dark"',
      'dark-mode',
      'theme-dark',
      'data-bs-theme="dark"',
      'prefers-color-scheme: dark',
      'color-scheme: dark',
      '--bg-color: #',
      'background: #0',
      'background: #1',
      'background: #2',
      'background-color: #0',
      'background-color: #1',
      'background-color: #2'
    ];

    // Check for dark mode class patterns
    const darkClassPatterns = [
      /class="[^"]*\bdark\b[^"]*"/g,
      /class="[^"]*\bnight\b[^"]*"/g,
      /class="[^"]*\bblack\b[^"]*"/g,
      /data-theme="[^"]*dark[^"]*"/g,
    ];

    // Check explicit indicators
    for (const indicator of darkModeIndicators) {
      if (html.includes(indicator)) {
        console.log(`[DARK_MODE] Detected via indicator: ${indicator}`);
        return true;
      }
    }

    // Check pattern matches
    for (const pattern of darkClassPatterns) {
      if (pattern.test(html)) {
        console.log(`[DARK_MODE] Detected via pattern: ${pattern}`);
        return true;
      }
    }

    // Analyze background colors to determine if the site is dark
    const backgroundColors = this.extractBackgroundColors();
    const isDarkBackground = this.analyzeBackgroundBrightness(backgroundColors);
    
    if (isDarkBackground) {
      console.log(`[DARK_MODE] Detected via background color analysis`);
      return true;
    }

    // Check for CSS properties that suggest dark mode (more specific)
    const darkCssProperties = [
      /body\s*\{[^}]*background[^:]*:\s*#[0-2][0-9a-f]{5}/gi,
      /html\s*\{[^}]*background[^:]*:\s*#[0-2][0-9a-f]{5}/gi,
      /--(?:background|bg-color|surface):\s*#[0-2][0-9a-f]{5}/gi,
    ];

    for (const pattern of darkCssProperties) {
      if (pattern.test(this.html)) {
        console.log(`[DARK_MODE] Detected via CSS properties`);
        return true;
      }
    }

    return false;
  }

  private extractBackgroundColors(): string[] {
    const backgrounds: string[] = [];
    
    // Extract from body and html elements (inline styles)
    const bodyBgMatch = this.html.match(/<body[^>]*style="[^"]*background[^"]*:\s*([^;"']+)[^"]*"/i);
    if (bodyBgMatch) backgrounds.push(bodyBgMatch[1]);
    
    const htmlBgMatch = this.html.match(/<html[^>]*style="[^"]*background[^"]*:\s*([^;"']+)[^"]*"/i);
    if (htmlBgMatch) backgrounds.push(htmlBgMatch[1]);
    
    // Extract from CSS - focus on main page backgrounds only
    const bodyBgPatterns = [
      /body\s*\{[^}]*background[^:]*:\s*([^;}]+)/gi,
      /html\s*\{[^}]*background[^:]*:\s*([^;}]+)/gi,
      /:root\s*\{[^}]*--(?:background|bg)[^:]*:\s*([^;}]+)/gi,
    ];
    
    bodyBgPatterns.forEach(pattern => {
      const matches = this.html.match(pattern) || [];
      matches.forEach(match => {
        const colorMatch = match.match(/background[^:]*:\s*([^;}]+)|--[^:]*:\s*([^;}]+)/);
        if (colorMatch) {
          const color = (colorMatch[1] || colorMatch[2]).trim();
          if (color && !color.includes('var(') && !color.includes('url(')) {
            backgrounds.push(color);
          }
        }
      });
    });
    
    return backgrounds;
  }

  private analyzeBackgroundBrightness(backgroundColors: string[]): boolean {
    if (backgroundColors.length === 0) return false;
    
    let darkCount = 0;
    let lightCount = 0;
    
    for (const color of backgroundColors) {
      if (this.isColorDark(color)) {
        darkCount++;
      } else {
        lightCount++;
      }
    }
    
    // Only consider it dark if we have clear evidence of dark backgrounds
    // and they significantly outweigh light ones
    return darkCount > 0 && darkCount > lightCount;
  }

  private isColorDark(color: string): boolean {
    const cleanColor = color.trim().toLowerCase();
    
    // Handle common light colors first (most websites use these)
    const commonLightColors = ['#fff', '#ffffff', 'white', '#f6f9fb', '#fafafa', '#f5f5f5', 'transparent', 'none'];
    if (commonLightColors.includes(cleanColor)) {
      return false;
    }
    
    // Handle common dark colors
    const commonDarkColors = ['#000', '#000000', 'black'];
    if (commonDarkColors.includes(cleanColor)) {
      return true;
    }
    
    // Handle hex colors
    if (cleanColor.startsWith('#')) {
      const hex = cleanColor.slice(1);
      if (hex.length === 3) {
        // Convert 3-digit hex to 6-digit
        const r = parseInt(hex[0] + hex[0], 16);
        const g = parseInt(hex[1] + hex[1], 16);
        const b = parseInt(hex[2] + hex[2], 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance < 0.5;
      } else if (hex.length === 6) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance < 0.5;
      }
    }
    
    // Handle rgb colors
    if (cleanColor.startsWith('rgb')) {
      const rgbMatch = cleanColor.match(/rgb\w*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
      if (rgbMatch) {
        const r = parseInt(rgbMatch[1]);
        const g = parseInt(rgbMatch[2]);
        const b = parseInt(rgbMatch[3]);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance < 0.5;
      }
    }
    
    // Handle named colors
    const darkNamedColors = ['black', 'darkblue', 'darkgreen', 'darkred', 'navy', 'maroon'];
    if (darkNamedColors.some(dark => cleanColor.includes(dark))) {
      return true;
    }
    
    // Default to light if we can't determine
    return false;
  }

  private getColorFrequency(colors: string[]): Record<string, number> {
    const frequency: Record<string, number> = {};
    for (const color of colors) {
      frequency[color] = (frequency[color] || 0) + 1;
    }
    return frequency;
  }

     getMethodsUsed(): string[] {
     return this.methodsUsed;
   }

   /**
    * Step 1: Extract ALL possible colors from the website
    */
   private async extractAllColorsFromWebsite(): Promise<Record<string, {color: string, frequency: number, contexts: string[]}>> {
     const colorData: Record<string, {color: string, frequency: number, contexts: string[]}> = {};
     
     // Extract from HTML
     this.extractColorsFromHtml(colorData);
     
     // Extract from external CSS files
     await this.extractColorsFromCssFiles(colorData);
     
     // Extract from inline styles
     this.extractColorsFromInlineStyles(colorData);
     
     // Extract from SVG elements
     this.extractColorsFromSvg(colorData);
     
     // Extract from script tags (CSS-in-JS)
     this.extractColorsFromScripts(colorData);
     
     return colorData;
   }

   private extractColorsFromHtml(colorData: Record<string, {color: string, frequency: number, contexts: string[]}>) {
     // Extract all hex colors (3 and 6 digit)
     const hexColors = [
       ...(this.html.match(/#[0-9a-fA-F]{6}/g) || []),
       ...(this.html.match(/#[0-9a-fA-F]{3}/g) || [])
     ];
     
     // Extract RGB colors
     const rgbMatches = this.html.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g) || [];
     
     // Extract RGBA colors
     const rgbaMatches = this.html.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*[\d.]+\s*\)/g) || [];
     
     // Process hex colors
     for (const color of hexColors) {
       let normalizedColor = color.toLowerCase();
       
       // Convert 3-digit to 6-digit hex
       if (normalizedColor.length === 4) {
         normalizedColor = `#${normalizedColor[1]}${normalizedColor[1]}${normalizedColor[2]}${normalizedColor[2]}${normalizedColor[3]}${normalizedColor[3]}`;
       }
       
       if (isValidColor(normalizedColor)) {
         this.addColorToData(colorData, normalizedColor, this.getColorContext(color));
       }
     }
     
     // Process RGB colors
     for (const rgbColor of [...rgbMatches, ...rgbaMatches]) {
       const rgbMatch = rgbColor.match(/rgb\w*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*/);
       if (rgbMatch) {
         const r = parseInt(rgbMatch[1]);
         const g = parseInt(rgbMatch[2]);
         const b = parseInt(rgbMatch[3]);
         const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
         
         if (isValidColor(hex)) {
           this.addColorToData(colorData, hex, this.getColorContext(rgbColor));
         }
       }
     }
   }

   private async extractColorsFromCssFiles(colorData: Record<string, {color: string, frequency: number, contexts: string[]}>) {
     const cssLinks = this.html.match(/href=["']([^"']*\.css[^"']*)["']/g) || [];
     
     for (const link of cssLinks.slice(0, 3)) { // Limit for performance
       const urlMatch = link.match(/href=["']([^"']+)["']/);
       if (urlMatch) {
         let cssUrl = urlMatch[1];
         
         // Convert relative URLs to absolute
         if (cssUrl.startsWith('//')) {
           cssUrl = `https:${cssUrl}`;
         } else if (cssUrl.startsWith('/')) {
           cssUrl = `https://${this.domain}${cssUrl}`;
         } else if (!cssUrl.startsWith('http')) {
           cssUrl = `https://${this.domain}/${cssUrl}`;
         }
         
         try {
           const cssResponse = await fetch(cssUrl, {
             headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
           });
           
           if (cssResponse.ok) {
             const cssText = await cssResponse.text();
             this.extractColorsFromCssText(cssText, colorData, `css-file: ${cssUrl.split('/').pop()}`);
           }
         } catch (error) {
           // CSS fetch failed, continue with other files
         }
       }
     }
   }

   private extractColorsFromCssText(cssText: string, colorData: Record<string, {color: string, frequency: number, contexts: string[]}>, source: string) {
     // Extract hex colors
     const hexColors = cssText.match(/#[0-9a-fA-F]{3,6}/g) || [];
     for (const color of hexColors) {
       let normalizedColor = color.toLowerCase();
       if (normalizedColor.length === 4) {
         normalizedColor = `#${normalizedColor[1]}${normalizedColor[1]}${normalizedColor[2]}${normalizedColor[2]}${normalizedColor[3]}${normalizedColor[3]}`;
       }
       if (isValidColor(normalizedColor)) {
         this.addColorToData(colorData, normalizedColor, source);
       }
     }
     
     // Extract RGB colors
     const rgbMatches = cssText.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g) || [];
     for (const rgbColor of rgbMatches) {
       const rgbMatch = rgbColor.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
       if (rgbMatch) {
         const r = parseInt(rgbMatch[1]);
         const g = parseInt(rgbMatch[2]);
         const b = parseInt(rgbMatch[3]);
         const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
         
         if (isValidColor(hex)) {
           this.addColorToData(colorData, hex, source);
         }
       }
     }
   }

   private extractColorsFromInlineStyles(colorData: Record<string, {color: string, frequency: number, contexts: string[]}>) {
     const inlineStyleMatches = this.html.match(/style=["'][^"']*["']/gi) || [];
     
     for (const styleMatch of inlineStyleMatches) {
       // Extract colors from this inline style
       const hexColors = styleMatch.match(/#[0-9a-fA-F]{3,6}/g) || [];
       const rgbColors = styleMatch.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g) || [];
       
       for (const color of hexColors) {
         let normalizedColor = color.toLowerCase();
         if (normalizedColor.length === 4) {
           normalizedColor = `#${normalizedColor[1]}${normalizedColor[1]}${normalizedColor[2]}${normalizedColor[2]}${normalizedColor[3]}${normalizedColor[3]}`;
         }
         if (isValidColor(normalizedColor)) {
           this.addColorToData(colorData, normalizedColor, 'inline-style');
         }
       }
       
       for (const rgbColor of rgbColors) {
         const rgbMatch = rgbColor.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
         if (rgbMatch) {
           const r = parseInt(rgbMatch[1]);
           const g = parseInt(rgbMatch[2]);
           const b = parseInt(rgbMatch[3]);
           const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
           
           if (isValidColor(hex)) {
             this.addColorToData(colorData, hex, 'inline-style');
           }
         }
       }
     }
   }

   private extractColorsFromSvg(colorData: Record<string, {color: string, frequency: number, contexts: string[]}>) {
     const svgMatches = this.html.match(/<svg[^>]*>[\s\S]*?<\/svg>/gi) || [];
     
     for (const svg of svgMatches) {
       const fillColors = svg.match(/fill=["']#[0-9a-fA-F]{3,6}["']/gi) || [];
       const strokeColors = svg.match(/stroke=["']#[0-9a-fA-F]{3,6}["']/gi) || [];
       
       for (const fillMatch of fillColors) {
         const colorMatch = fillMatch.match(/#[0-9a-fA-F]{3,6}/);
         if (colorMatch) {
           let color = colorMatch[0].toLowerCase();
           if (color.length === 4) {
             color = `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
           }
           if (isValidColor(color)) {
             this.addColorToData(colorData, color, 'svg-fill');
           }
         }
       }
       
       for (const strokeMatch of strokeColors) {
         const colorMatch = strokeMatch.match(/#[0-9a-fA-F]{3,6}/);
         if (colorMatch) {
           let color = colorMatch[0].toLowerCase();
           if (color.length === 4) {
             color = `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
           }
           if (isValidColor(color)) {
             this.addColorToData(colorData, color, 'svg-stroke');
           }
         }
       }
     }
   }

   private extractColorsFromScripts(colorData: Record<string, {color: string, frequency: number, contexts: string[]}>) {
     const scriptTags = this.html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
     
     for (const scriptTag of scriptTags) {
       const hexColors = scriptTag.match(/#[0-9a-fA-F]{3,6}/g) || [];
       
       for (const color of hexColors) {
         let normalizedColor = color.toLowerCase();
         if (normalizedColor.length === 4) {
           normalizedColor = `#${normalizedColor[1]}${normalizedColor[1]}${normalizedColor[2]}${normalizedColor[2]}${normalizedColor[3]}${normalizedColor[3]}`;
         }
         if (isValidColor(normalizedColor)) {
           this.addColorToData(colorData, normalizedColor, 'css-in-js');
         }
       }
     }
   }

   private addColorToData(colorData: Record<string, {color: string, frequency: number, contexts: string[]}>, color: string, context: string) {
     if (!colorData[color]) {
       colorData[color] = {
         color,
         frequency: 0,
         contexts: []
       };
     }
     
     colorData[color].frequency++;
     if (!colorData[color].contexts.includes(context)) {
       colorData[color].contexts.push(context);
     }
   }

   private getColorContext(color: string): string {
     const colorIndex = this.html.indexOf(color);
     const context = this.html.substring(Math.max(0, colorIndex - 100), colorIndex + 100).toLowerCase();
     
     if (context.includes('logo')) return 'logo';
     if (context.includes('brand')) return 'brand';
     if (context.includes('primary')) return 'primary';
     if (context.includes('button')) return 'button';
     if (context.includes('cta')) return 'cta';
     if (context.includes('header')) return 'header';
     if (context.includes('nav')) return 'nav';
     if (context.includes('svg')) return 'svg';
     if (context.includes('background')) return 'background';
     if (context.includes('text')) return 'text';
     
     return 'general';
   }

   /**
    * Step 2: First LLM - Analyze and categorize all colors
    */
   private async categorizeColorsWithLLM(allColors: Record<string, {color: string, frequency: number, contexts: string[]}>): Promise<any> {
     try {
       // Prepare color data for LLM analysis
       const colorList = Object.values(allColors)
         .sort((a, b) => b.frequency - a.frequency) // Sort by frequency
         .slice(0, 20) // Limit to top 20 colors to avoid token limits
         .map(colorData => ({
           color: colorData.color,
           frequency: colorData.frequency,
           contexts: colorData.contexts
         }));

       const prompt = `Analyze these colors extracted from ${this.domain} and categorize them by their likely purpose.

Domain: ${this.domain}

Colors found (sorted by frequency):
${colorList.map(c => `${c.color} (appears ${c.frequency} times in: ${c.contexts.join(', ')})`).join('\n')}

Please categorize these colors into:
1. **brand** - Primary brand colors (vibrant, used for logos, CTAs, brand elements)
2. **neutral** - Neutral colors (grays, whites, blacks used for text, backgrounds)
3. **ui** - UI colors (borders, dividers, subtle backgrounds)
4. **accent** - Secondary brand colors or accent colors
5. **ignore** - Colors that are likely not relevant (very common web colors, etc.)

Consider:
- Brand colors are usually vibrant and used in logos, buttons, CTAs
- Neutral colors are grays, whites, blacks for text and backgrounds  
- UI colors are subtle colors for borders, dividers, cards
- Frequency and context matter - colors in 'logo', 'brand', 'primary', 'button' contexts are likely brand colors
- Very common colors like pure white (#ffffff) or pure black (#000000) are usually neutral

Return ONLY a JSON object with this structure:
{
  "brand": ["#color1", "#color2"],
  "neutral": ["#color3", "#color4"],
  "ui": ["#color5"],
  "accent": ["#color6"],
  "ignore": ["#color7"],
  "analysis": "Brief explanation of your categorization decisions"
}`;

       const response = await this.callOpenAI(prompt);
       
       if (response) {
         this.methodsUsed.push('llm-color-categorization');
         return response;
       }
       
       return null;
     } catch (error) {
       return null;
     }
   }

   /**
    * Step 3: Second LLM - Generate consistent theme using our theme tokens
    */
   private async generateThemeWithLLM(categorizedColors: any): Promise<Record<string, string>> {
     try {
       if (!categorizedColors) {
         // Fallback to basic extraction if categorization failed
         return this.generateFallbackTheme();
       }

       const prompt = `Generate a complete theme using shadcn/ui design tokens based on these categorized colors from ${this.domain}.

Categorized Colors:
- Brand colors: ${categorizedColors.brand?.join(', ') || 'none'}
- Neutral colors: ${categorizedColors.neutral?.join(', ') || 'none'}  
- UI colors: ${categorizedColors.ui?.join(', ') || 'none'}
- Accent colors: ${categorizedColors.accent?.join(', ') || 'none'}

Analysis: ${categorizedColors.analysis || 'No analysis provided'}

Generate a complete theme with ALL these shadcn/ui CSS custom properties:

**Required Theme Variables:**
- --background (main app background)
- --foreground (main text color)
- --card (elevated surfaces like modals)
- --card-foreground
- --popover (floating elements)
- --popover-foreground
- --primary (main brand color for buttons, links)
- --primary-foreground
- --primary-light (lighter variant)
- --primary-dark (darker variant)
- --secondary (less prominent buttons)
- --secondary-foreground
- --muted (disabled states, placeholders)
- --muted-foreground
- --accent (hover states, highlights)
- --accent-foreground
- --destructive (error states)
- --destructive-foreground
- --success (success states)
- --success-foreground
- --warning (warning states)
- --warning-foreground
- --border (form elements, dividers)
- --input (form inputs)
- --sidebar (navigation sidebar)
- --splash (loading screens, brand moments)

**Rules:**
1. Use the BEST brand color as --primary (main brand color)
2. Use neutral colors for backgrounds, text, borders
3. Ensure proper contrast ratios (WCAG AA compliant)
4. Create a cohesive color palette
5. --primary should be the most vibrant brand color
6. --background and --foreground should have high contrast
7. All colors must be valid hex codes (#rrggbb format)

Return ONLY a JSON object with this structure:
{
  "variables": {
    "--background": "#ffffff",
    "--foreground": "#000000",
    "--card": "#ffffff",
    "--card-foreground": "#000000",
    "--popover": "#ffffff", 
    "--popover-foreground": "#000000",
    "--primary": "#0066cc",
    "--primary-foreground": "#ffffff",
    "--primary-light": "#3388dd",
    "--primary-dark": "#004499",
    "--secondary": "#f5f5f5",
    "--secondary-foreground": "#000000",
    "--muted": "#f5f5f5",
    "--muted-foreground": "#666666",
    "--accent": "#f0f0f0",
    "--accent-foreground": "#000000",
    "--destructive": "#dc2626",
    "--destructive-foreground": "#ffffff",
    "--success": "#16a34a",
    "--success-foreground": "#ffffff", 
    "--warning": "#ea580c",
    "--warning-foreground": "#ffffff",
    "--border": "#e5e5e5",
    "--input": "#e5e5e5",
    "--sidebar": "#fafafa",
    "--splash": "#0066cc"
  },
  "isDark": false,
  "reasoning": "Brief explanation of color choices and theme decisions"
}`;

       const response = await this.callOpenAI(prompt);
       
       if (response?.variables) {
         this.methodsUsed.push('llm-theme-generation');
         return response.variables;
       }
       
       return this.generateFallbackTheme();
     } catch (error) {
       return this.generateFallbackTheme();
     }
   }

   private generateFallbackTheme(): Record<string, string> {
     // Fallback theme if LLM fails - use enhanced dark mode detection
     const isDark = this.detectDarkMode();
     console.log(`[FALLBACK_THEME] Generated theme for ${this.domain}, isDark: ${isDark}`);
     
     return {
       "--background": isDark ? "#0f0f0f" : "#ffffff",
       "--foreground": isDark ? "#ffffff" : "#292524",
       "--card": isDark ? "#1c1c1c" : "#ffffff",
       "--card-foreground": isDark ? "#ffffff" : "#292524",
       "--popover": isDark ? "#232323" : "#ffffff",
       "--popover-foreground": isDark ? "#ffffff" : "#292524",
       "--primary": "#d0ec1a", // deco green fallback
       "--primary-foreground": "#000000",
       "--primary-light": "#e5f563",
       "--primary-dark": "#9bb800",
       "--secondary": isDark ? "#292929" : "#f5f5f4",
       "--secondary-foreground": isDark ? "#ffffff" : "#292524",
       "--muted": isDark ? "#232323" : "#f5f5f4",
       "--muted-foreground": isDark ? "#9ca3af" : "#78716c",
       "--accent": isDark ? "#2e2e2e" : "#f5f5f4",
       "--accent-foreground": isDark ? "#ffffff" : "#292524",
       "--destructive": "#dc2626",
       "--destructive-foreground": "#ffffff",
       "--success": "#16a34a",
       "--success-foreground": "#ffffff",
       "--warning": "#ea580c",
       "--warning-foreground": "#ffffff",
       "--border": isDark ? "#353535" : "#e7e5e4",
       "--input": isDark ? "#353535" : "#e7e5e4",
       "--sidebar": isDark ? "#171717" : "#fafafa",
       "--splash": "#d0ec1a"
     };
   }
 }

// Helper functions for metadata extraction
function extractFavicon(html: string, domain: string): string | undefined {
  const faviconMatch = html.match(/<link[^>]*rel=["'](?:icon|shortcut icon)["'][^>]*href=["']([^"']+)["']/i);
  if (faviconMatch) {
    let favicon = faviconMatch[1];
    if (!favicon.startsWith("http")) {
      favicon = new URL(favicon, `https://${domain}`).href;
    }
    return favicon;
  }
  return undefined;
}

function extractLogo(html: string, domain: string): string | undefined {
  const logoMatch = html.match(/<img[^>]*(?:class|id)=["'][^"']*logo[^"']*["'][^>]*src=["']([^"']+)["']/i);
  if (logoMatch) {
    let logo = logoMatch[1];
    if (!logo.startsWith("http")) {
      logo = new URL(logo, `https://${domain}`).href;
    }
    return logo;
  }
  return undefined;
}

function extractCompanyName(html: string): string | undefined {
  const ogSiteNameMatch = html.match(/<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']/i);
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  
  if (ogSiteNameMatch) {
    return ogSiteNameMatch[1];
  } else if (titleMatch) {
    return titleMatch[1].split(/[|\-–]/)[0].trim();
  }
  return undefined;
}

// Helper function to validate if a string is a valid color
function isValidColor(color: string): boolean {
  if (!color) return false;
  
  const cleanColor = color.trim();
  
  // Check hex colors (3, 4, 6, or 8 digits)
  if (cleanColor.match(/^#[0-9a-fA-F]{3,8}$/)) {
    return true;
  }
  
  // Check rgb/rgba colors (more flexible)
  if (cleanColor.match(/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+)?\s*\)$/)) {
    return true;
  }
  
  // Check hsl/hsla colors
  if (cleanColor.match(/^hsla?\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*(?:,\s*[\d.]+)?\s*\)$/)) {
    return true;
  }
  
  // Check CSS color functions
  if (cleanColor.match(/^(?:oklch|lch|lab|color)\([^)]+\)$/)) {
    return true;
  }
  
  // Check named colors (expanded list)
  const namedColors = [
    'black', 'white', 'red', 'green', 'blue', 'yellow', 'orange', 'purple', 'pink', 'gray', 'grey',
    'navy', 'teal', 'cyan', 'magenta', 'lime', 'maroon', 'olive', 'silver', 'aqua', 'fuchsia',
    'transparent', 'currentcolor', 'inherit', 'initial', 'unset'
  ];
  if (namedColors.includes(cleanColor.toLowerCase())) {
    return true;
  }
  
  // Reject obviously invalid colors
  if (cleanColor.includes('NaN') || cleanColor.includes('undefined') || cleanColor.includes('}')) {
    return false;
  }
  
  return false;
}

// Helper function to convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

// Helper function to check if two RGB colors are similar
function isColorSimilar(rgb1: { r: number; g: number; b: number }, rgb2: { r: number; g: number; b: number }, threshold: number): boolean {
  const rDiff = Math.abs(rgb1.r - rgb2.r);
  const gDiff = Math.abs(rgb1.g - rgb2.g);
  const bDiff = Math.abs(rgb1.b - rgb2.b);
  
  return rDiff <= threshold && gDiff <= threshold && bDiff <= threshold;
}

// Helper function to check if a color is a common neutral (gray, white, black, etc.)
function isCommonNeutral(color: string): boolean {
  const hex = color.toLowerCase().replace('#', '');
  if (hex.length !== 6) return false;
  
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  
  // Check for grayscale colors (where R, G, B are very close)
  const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
  if (maxDiff < 15) return true; // Grayscale
  
  // Check for very common web colors
  const commonNeutrals = [
    'ffffff', '000000', 'f8f9fa', 'e9ecef', 'dee2e6', 'ced4da', 
    'adb5bd', '6c757d', '495057', '343a40', '212529', 'f5f5f5',
    'eeeeee', 'e0e0e0', 'bdbdbd', '9e9e9e', '757575', '616161',
    '424242', '303030', '1a1a1a', 'fafafa', 'f0f0f0'
  ];
  
  return commonNeutrals.includes(hex);
}

// Helper function to determine if a color is vibrant (suitable for brand use)
function isVibrantColor(color: string): boolean {
  // Remove any CSS function wrappers and get the hex value
  let hex = color.trim();
  
  // Convert rgb to hex if needed
  if (hex.startsWith('rgb')) {
    const rgbMatch = hex.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1]);
      const g = parseInt(rgbMatch[2]);
      const b = parseInt(rgbMatch[3]);
      hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
  }
  
  if (!hex.startsWith('#') || (hex.length !== 4 && hex.length !== 7)) {
    return false;
  }
  
  // Convert 3-digit hex to 6-digit
  if (hex.length === 4) {
    hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  
  // Calculate saturation and brightness
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  const brightness = max / 255;
  
  // A color is vibrant if it has good saturation and isn't too dark or too light
  // Also exclude very common neutral colors
  const isNeutral = Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && Math.abs(r - b) < 20;
  
  return saturation > 0.3 && brightness > 0.2 && brightness < 0.9 && !isNeutral;
}

// Helper function to determine if a color is dark
function isColorDark(color: string): boolean {
  // Remove any CSS function wrappers and get the hex value
  const cleanColor = color.replace(/rgb\(|\)|rgba\(|hsl\(|hsla\(/g, '').trim();
  
  // Handle hex colors
  if (cleanColor.startsWith('#')) {
    const hex = cleanColor.slice(1);
    if (hex.length === 3) {
      // Convert 3-digit hex to 6-digit
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance < 0.5;
    } else if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance < 0.5;
    }
  }
  
  // Handle rgb/rgba values
  if (cleanColor.includes(',')) {
    const values = cleanColor.split(',').map(v => parseInt(v.trim()));
    if (values.length >= 3) {
      const [r, g, b] = values;
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance < 0.5;
    }
  }
  
  // Handle named colors - assume common dark colors
  const darkColors = ['black', 'dark', 'navy', 'maroon', 'darkblue', 'darkgreen', 'darkred'];
  return darkColors.some(dark => cleanColor.toLowerCase().includes(dark));
}

// Minimal local createTool helper to avoid package export mismatch
function createTool<T extends z.ZodType, U extends z.ZodType>(config: {
  id: string;
  description: string;
  inputSchema: T;
  outputSchema: U;
  execute: (params: { inputData: z.infer<T> }) => Promise<z.infer<U>>;
}) {
  return config;
}

#!/usr/bin/env node

// Advanced test script that mirrors our actual extraction logic
const testDomains = [
  { domain: 'mistral.ai', expected: '#e00400' },
  { domain: 'github.com', expected: '#238636' },
  { domain: 'stripe.com', expected: '#635bff' },
  { domain: 'deco.cx', expected: '#d0ec1a' }
];

class BrandColorExtractor {
  constructor(domain, html) {
    this.domain = domain;
    this.html = html;
    this.methodsUsed = [];
  }

  async extractColors() {
    const colors = {};

    // Method 1: Meta theme-color
    this.extractMetaThemeColor(colors);

    // Method 2: Look for specific brand color patterns first
    this.extractSpecificBrandPatterns(colors);

    // Method 3: CSS custom properties from external stylesheets
    await this.extractCssCustomProperties(colors);

    // Method 4: SVG fill colors (but be more selective)
    this.extractSvgFillColors(colors);

    // Method 4: Weighted color frequency analysis
    this.extractFrequentBrandColors(colors);

    // Method 5: CSS selectors with brand-related names
    this.extractBrandSelectors(colors);

    // Method 6: Inline styles analysis
    this.extractInlineStyles(colors);

    // Method 7: RGB/HSL color conversion
    this.extractRgbHslColors(colors);

    // Set defaults
    this.setDefaultColors(colors);

    return colors;
  }

  extractMetaThemeColor(colors) {
    const themeColorMatch = this.html.match(/<meta\s+name=["']theme-color["']\s+content=["']([^"']+)["']/i);
    if (themeColorMatch && this.isValidColor(themeColorMatch[1])) {
      colors.primary = themeColorMatch[1];
      this.methodsUsed.push('meta-theme-color');
      console.log(`[${this.domain}] Meta theme-color found:`, colors.primary);
    }
  }

  extractSpecificBrandPatterns(colors) {
    if (colors.primary) return;
    
    // Look for specific patterns that are likely to contain brand colors
    const brandPatterns = [
      /<a[^>]*class="[^"]*(?:btn-primary|Button--primary)[^"]*"[^>]*>/gi,
      /<button[^>]*class="[^"]*(?:btn-primary|Button--primary)[^"]*"[^>]*>/gi,
      /<(?:a|button)[^>]*class="[^"]*(?:cta|call-to-action|primary|brand)[^"]*"[^>]*>/gi,
      /<[^>]*class="[^"]*logo[^"]*"[^>]*>/gi,
      /<(?:header|nav)[^>]*class="[^"]*(?:primary|brand)[^"]*"[^>]*>/gi,
    ];

    const contextualColors = [];

    for (const pattern of brandPatterns) {
      const matches = this.html.match(pattern) || [];
      for (const match of matches) {
        const matchIndex = this.html.indexOf(match);
        const surroundingContext = this.html.substring(
          Math.max(0, matchIndex - 500), 
          Math.min(this.html.length, matchIndex + match.length + 500)
        );

        const hexColors = surroundingContext.match(/#[0-9a-fA-F]{3,6}/g) || [];
        const rgbColors = surroundingContext.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g) || [];

        for (const hexColor of hexColors) {
          let normalizedColor = hexColor.toLowerCase();
          if (normalizedColor.length === 4) {
            normalizedColor = `#${normalizedColor[1]}${normalizedColor[1]}${normalizedColor[2]}${normalizedColor[2]}${normalizedColor[3]}${normalizedColor[3]}`;
          }
          
          if (this.isVibrantColor(normalizedColor) && !this.isCommonNeutral(normalizedColor)) {
            let priority = 1;
            const lowerMatch = match.toLowerCase();
            if (lowerMatch.includes('btn-primary') || lowerMatch.includes('button--primary')) priority = 5;
            else if (lowerMatch.includes('cta') || lowerMatch.includes('call-to-action')) priority = 4;
            else if (lowerMatch.includes('logo')) priority = 4;
            else if (lowerMatch.includes('primary') || lowerMatch.includes('brand')) priority = 3;
            
            contextualColors.push({ color: normalizedColor, priority, context: match.substring(0, 100) });
          }
        }

        for (const rgbColor of rgbColors) {
          const rgbMatch = rgbColor.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
          if (rgbMatch) {
            const r = parseInt(rgbMatch[1]);
            const g = parseInt(rgbMatch[2]);
            const b = parseInt(rgbMatch[3]);
            const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
            
            if (this.isVibrantColor(hex) && !this.isCommonNeutral(hex)) {
              let priority = 1;
              const lowerMatch = match.toLowerCase();
              if (lowerMatch.includes('btn-primary') || lowerMatch.includes('button--primary')) priority = 5;
              else if (lowerMatch.includes('cta') || lowerMatch.includes('call-to-action')) priority = 4;
              else if (lowerMatch.includes('logo')) priority = 4;
              else if (lowerMatch.includes('primary') || lowerMatch.includes('brand')) priority = 3;
              
              contextualColors.push({ color: hex, priority, context: match.substring(0, 100) });
            }
          }
        }
      }
    }

    if (contextualColors.length > 0) {
      contextualColors.sort((a, b) => b.priority - a.priority);
      colors.primary = contextualColors[0].color;
      this.methodsUsed.push('specific-brand-patterns');
      console.log(`[${this.domain}] Specific brand pattern found:`, colors.primary, `(priority: ${contextualColors[0].priority})`);
    }
  }

  extractSvgFillColors(colors) {
    const svgFillMatches = this.html.match(/fill=["']#[0-9a-fA-F]{6}["']/gi) || [];
    const brandColors = [];

    for (const fillMatch of svgFillMatches) {
      const colorMatch = fillMatch.match(/#[0-9a-fA-F]{6}/);
      if (colorMatch) {
        const color = colorMatch[0].toLowerCase();
        if (this.isVibrantColor(color) && !this.isCommonNeutral(color)) {
          brandColors.push(color);
        }
      }
    }

    if (brandColors.length > 0 && !colors.primary) {
      const colorFreq = this.getColorFrequency(brandColors);
      const mostFrequent = Object.entries(colorFreq)
        .sort(([,a], [,b]) => b - a)[0];
      
      if (mostFrequent) {
        colors.primary = mostFrequent[0];
        this.methodsUsed.push('svg-fill');
        console.log(`[${this.domain}] SVG fill brand color found:`, colors.primary, `(freq: ${mostFrequent[1]})`);
      }
    }
  }

  async extractCssCustomProperties(colors) {
    const cssLinks = this.html.match(/href=["']([^"']*\.css[^"']*)["']/g) || [];
    const cssUrls = [];

    for (const link of cssLinks.slice(0, 3)) {
      const urlMatch = link.match(/href=["']([^"']+)["']/);
      if (urlMatch) {
        let cssUrl = urlMatch[1];
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
            console.log(`[${this.domain}] CSS custom property found:`, colors.primary);
            break;
          }
        }
      } catch (error) {
        // Ignore CSS fetch errors
      }
    }
  }

  analyzeCssForBrandColors(cssText, colors) {
    const brandPatterns = [
      /--[a-zA-Z0-9-_]*(?:brand|primary|main|logo|accent|success|green)[a-zA-Z0-9-_]*\s*:\s*(#[0-9a-fA-F]{3,6})/gi,
      /\.(?:btn|button|cta)[-_]?(?:primary|success|action|brand)?[^{]*\{[^}]*(?:background-color|background)\s*:\s*(#[0-9a-fA-F]{3,6})/gi,
      /\.(?:header|nav|navbar|brand|logo)[^{]*\{[^}]*(?:background-color|color)\s*:\s*(#[0-9a-fA-F]{3,6})/gi,
      /\.(?:color-fg-success|text-green|bg-success)[^{]*\{[^}]*(?:color|background-color)\s*:\s*(#[0-9a-fA-F]{3,6})/gi,
      /\.(?:bg-primary|text-primary|accent)[^{]*\{[^}]*(?:background-color|color)\s*:\s*(#[0-9a-fA-F]{3,6})/gi,
    ];

    const foundColors = [];

    for (const pattern of brandPatterns) {
      const matches = cssText.match(pattern) || [];
      for (const match of matches) {
        const colorMatch = match.match(/#[0-9a-fA-F]{3,6}/);
        if (colorMatch) {
          let color = colorMatch[0].toLowerCase();
          
          if (color.length === 4) {
            color = `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
          }
          
          if (this.isVibrantColor(color) && !this.isCommonNeutral(color)) {
            let priority = 1;
            const lowerMatch = match.toLowerCase();
            if (lowerMatch.includes('brand') || lowerMatch.includes('primary')) priority = 5;
            else if (lowerMatch.includes('success') || lowerMatch.includes('action')) priority = 4;
            else if (lowerMatch.includes('logo') || lowerMatch.includes('main')) priority = 3;
            
            foundColors.push({ color, priority, context: match.substring(0, 80) });
          }
        }
      }
    }

    if (foundColors.length > 0 && !colors.primary) {
      foundColors.sort((a, b) => b.priority - a.priority);
      colors.primary = foundColors[0].color;
      console.log(`[${this.domain}] CSS pattern found:`, colors.primary, `(priority: ${foundColors[0].priority})`);
    }
  }

  extractFrequentBrandColors(colors) {
    const allHexColors = [
      ...(this.html.match(/#[0-9a-fA-F]{6}/g) || []),
      ...(this.html.match(/#[0-9a-fA-F]{3}/g) || [])
    ];
    
    const colorFrequency = {};
    const contextWeights = {};

    for (const color of allHexColors) {
      let normalizedColor = color.toLowerCase();
      
      if (normalizedColor.length === 4) {
        normalizedColor = `#${normalizedColor[1]}${normalizedColor[1]}${normalizedColor[2]}${normalizedColor[2]}${normalizedColor[3]}${normalizedColor[3]}`;
      }
      
      colorFrequency[normalizedColor] = (colorFrequency[normalizedColor] || 0) + 1;
      
      const colorIndex = this.html.indexOf(color);
      const context = this.html.substring(Math.max(0, colorIndex - 300), colorIndex + 300).toLowerCase();
      
      let weight = 1;
      if (context.includes('logo') || context.includes('brand')) weight += 5;
      if (context.includes('primary') || context.includes('main')) weight += 4;
      if (context.includes('header') || context.includes('nav')) weight += 3;
      if (context.includes('button') || context.includes('cta')) weight += 3;
      if (context.includes('svg') || context.includes('fill')) weight += 3;
      if (context.includes('success') || context.includes('action')) weight += 3;
      if (context.includes('color-fg-success') || context.includes('text-green')) weight += 4;
      if (context.includes('bg-primary') || context.includes('accent')) weight += 4;
      if (context.includes('<a ') || context.includes('link')) weight += 2;
      
      contextWeights[normalizedColor] = Math.max(contextWeights[normalizedColor] || 0, weight);
    }

    const brandCandidates = Object.entries(colorFrequency)
      .filter(([color, count]) => {
        const weight = contextWeights[color] || 1;
        return ((count >= 1 && weight >= 3) || count >= 2) && this.isVibrantColor(color) && !this.isCommonNeutral(color);
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
      console.log(`[${this.domain}] Weighted frequency found:`, colors.primary, 
        `(count: ${brandCandidates[0].count}, weight: ${brandCandidates[0].weight}, score: ${brandCandidates[0].score})`);
    }
  }

  extractBrandSelectors(colors) {
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
          if (this.isVibrantColor(color) && !colors.primary) {
            colors.primary = color;
            this.methodsUsed.push('brand-selectors');
            console.log(`[${this.domain}] Brand selector found:`, colors.primary);
            return;
          }
        }
      }
    }
  }

  extractInlineStyles(colors) {
    const inlineStyleMatches = this.html.match(/style=["'][^"']*(?:background-color|color)\s*:\s*#[0-9a-fA-F]{6}[^"']*["']/gi) || [];
    
    for (const styleMatch of inlineStyleMatches) {
      const colorMatch = styleMatch.match(/#[0-9a-fA-F]{6}/);
      if (colorMatch) {
        const color = colorMatch[0].toLowerCase();
        if (this.isVibrantColor(color) && !this.isCommonNeutral(color) && !colors.primary) {
          colors.primary = color;
          this.methodsUsed.push('inline-styles');
          console.log(`[${this.domain}] Inline style found:`, colors.primary);
          return;
        }
      }
    }
  }

  extractRgbHslColors(colors) {
    if (colors.primary) return;
    
    const rgbMatches = this.html.match(/(?:background-color|color)\s*:\s*rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/gi) || [];
    const brandRgbColors = [];
    
    for (const match of rgbMatches) {
      const rgbMatch = match.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
      if (rgbMatch) {
        const r = parseInt(rgbMatch[1]);
        const g = parseInt(rgbMatch[2]);
        const b = parseInt(rgbMatch[3]);
        
        const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        
        if (this.isVibrantColor(hex) && !this.isCommonNeutral(hex)) {
          const matchIndex = this.html.indexOf(match);
          const context = this.html.substring(Math.max(0, matchIndex - 200), matchIndex + 200).toLowerCase();
          
          let priority = 0;
          if (context.includes('brand') || context.includes('primary')) priority += 5;
          if (context.includes('logo') || context.includes('main')) priority += 4;
          if (context.includes('button') || context.includes('cta')) priority += 3;
          
          if (priority > 0) {
            brandRgbColors.push({ color: hex, context: match });
          }
        }
      }
    }
    
    if (brandRgbColors.length > 0) {
      colors.primary = brandRgbColors[0].color;
      this.methodsUsed.push('rgb-conversion');
      console.log(`[${this.domain}] RGB conversion found:`, colors.primary);
    }
  }

  setDefaultColors(colors) {
    const isDarkMode = 
      this.html.includes('data-theme="dark"') ||
      this.html.includes('class="dark"') ||
      this.html.includes('dark-mode') ||
      this.html.includes('prefers-color-scheme: dark');

    if (!colors.background) {
      colors.background = isDarkMode ? "#0f0f0f" : "#ffffff";
    }
    if (!colors.foreground) {
      colors.foreground = isDarkMode ? "#ffffff" : "#292524";
    }
  }

  getColorFrequency(colors) {
    const frequency = {};
    for (const color of colors) {
      frequency[color] = (frequency[color] || 0) + 1;
    }
    return frequency;
  }

  isValidColor(color) {
    if (!color) return false;
    const cleanColor = color.trim();
    return cleanColor.match(/^#[0-9a-fA-F]{3,8}$/) || 
           cleanColor.match(/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+)?\s*\)$/);
  }

  isVibrantColor(hex) {
    if (!hex.startsWith('#') || (hex.length !== 4 && hex.length !== 7)) {
      return false;
    }
    
    if (hex.length === 4) {
      hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    }
    
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    const brightness = max / 255;
    
    const isNeutral = Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && Math.abs(r - b) < 20;
    
    return saturation > 0.3 && brightness > 0.2 && brightness < 0.9 && !isNeutral;
  }

  isCommonNeutral(color) {
    const hex = color.toLowerCase().replace('#', '');
    if (hex.length !== 6) return false;
    
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    
    const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
    if (maxDiff < 15) return true;
    
    const commonNeutrals = [
      'ffffff', '000000', 'f8f9fa', 'e9ecef', 'dee2e6', 'ced4da', 
      'adb5bd', '6c757d', '495057', '343a40', '212529', 'f5f5f5',
      'eeeeee', 'e0e0e0', 'bdbdbd', '9e9e9e', '757575', '616161',
      '424242', '303030', '1a1a1a', 'fafafa', 'f0f0f0'
    ];
    
    return commonNeutrals.includes(hex);
  }

  getMethodsUsed() {
    return this.methodsUsed;
  }
}

function colorDistance(color1, color2) {
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);
  
  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);
  
  return Math.sqrt(Math.pow(r2 - r1, 2) + Math.pow(g2 - g1, 2) + Math.pow(b2 - b1, 2));
}

async function testColorExtraction(domain) {
  try {
    console.log(`\n🔍 Testing ${domain}...`);
    
    const response = await fetch(`https://${domain}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    console.log(`✅ Fetched HTML (${html.length} chars)`);
    
    const extractor = new BrandColorExtractor(domain, html);
    const colors = await extractor.extractColors();
    
    console.log(`📊 Methods used: ${extractor.getMethodsUsed().join(', ') || 'none'}`);
    console.log(`🎨 Extracted colors:`, colors);
    
    return { colors, methodsUsed: extractor.getMethodsUsed() };
    
  } catch (error) {
    console.error(`❌ Error testing ${domain}:`, error.message);
    return null;
  }
}

async function runTests() {
  console.log('🎨 Advanced Color Extraction Test Suite');
  console.log('========================================');
  
  for (const { domain, expected } of testDomains) {
    const results = await testColorExtraction(domain);
    
    if (results) {
      const extractedPrimary = results.colors.primary;
      
      console.log(`\n📋 Results for ${domain}:`);
      console.log(`   Expected: ${expected}`);
      console.log(`   Extracted: ${extractedPrimary || 'None found'}`);
      
      if (extractedPrimary) {
        const distance = colorDistance(extractedPrimary, expected);
        const isClose = distance < 50;
        const status = isClose ? '✅ CLOSE' : '❌ DIFFERENT';
        console.log(`   Distance: ${Math.round(distance)} RGB units - ${status}`);
        console.log(`   Methods: ${results.methodsUsed.join(', ')}`);
      } else {
        console.log(`   Status: ❌ NO BRAND COLOR FOUND`);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n🏁 Advanced test completed!');
}

runTests().catch(console.error);

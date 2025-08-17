#!/usr/bin/env node

// Test script for LLM-powered color extraction
const testDomains = [
  { domain: 'mistral.ai', expected: '#e00400' },
  { domain: 'github.com', expected: '#238636' },
  { domain: 'stripe.com', expected: '#635bff' },
  { domain: 'deco.cx', expected: '#d0ec1a' }
];

// Mock environment for testing
const mockEnv = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-key'
};

class BrandColorExtractor {
  constructor(domain, html, env) {
    this.domain = domain;
    this.html = html;
    this.env = env;
    this.methodsUsed = [];
  }

  async extractColors() {
    const colors = {};
    
    // Only test LLM method
    await this.extractColorsWithLLM(colors);
    
    return colors;
  }

  async extractColorsWithLLM(colors) {
    try {
      const htmlSample = this.extractRelevantHtmlSample();
      
      if (!htmlSample || htmlSample.length < 500) {
        console.log(`[${this.domain}] HTML sample too small for LLM analysis`);
        return;
      }

      console.log(`[${this.domain}] HTML sample size: ${htmlSample.length} chars`);

      const prompt = `Analyze this website HTML and identify the brand colors. Focus on finding the primary brand color, not UI colors like backgrounds or borders.

Domain: ${this.domain}

HTML Sample:
\`\`\`html
${htmlSample}
\`\`\`

Look for:
1. Brand/logo colors in SVG elements
2. Primary button colors (CTA buttons)
3. Link colors that represent the brand
4. Header/navigation brand elements
5. Colors used in brand-specific contexts

Ignore:
- Neutral colors (grays, whites, blacks)
- Background colors
- Border colors
- Text colors for readability

Return ONLY a JSON object with this exact structure:
{
  "primary": "#hexcolor",
  "secondary": "#hexcolor",
  "confidence": "high|medium|low",
  "reasoning": "brief explanation of why this is the brand color"
}

If no clear brand color is found, return:
{
  "primary": null,
  "confidence": "low",
  "reasoning": "no clear brand color identified"
}`;

      const response = await this.callOpenAI(prompt);
      
      if (response?.primary && this.isValidColor(response.primary)) {
        colors.primary = response.primary.toLowerCase();
        if (response.secondary && this.isValidColor(response.secondary)) {
          colors.secondary = response.secondary.toLowerCase();
        }
        
        this.methodsUsed.push('llm-analysis');
        console.log(`[${this.domain}] LLM analysis result:`, {
          primary: colors.primary,
          secondary: colors.secondary,
          confidence: response.confidence,
          reasoning: response.reasoning
        });
      } else {
        console.log(`[${this.domain}] LLM found no valid brand color:`, response);
      }
    } catch (error) {
      console.log(`[${this.domain}] LLM analysis failed:`, error.message);
    }
  }

  extractRelevantHtmlSample() {
    const samples = [];
    
    // Header section
    const headerMatch = this.html.match(/<header[^>]*>[\s\S]*?<\/header>/i);
    if (headerMatch) samples.push(headerMatch[0]);
    
    // Navigation section
    const navMatch = this.html.match(/<nav[^>]*>[\s\S]*?<\/nav>/i);
    if (navMatch) samples.push(navMatch[0]);
    
    // Logo elements
    const logoMatches = this.html.match(/<[^>]*class="[^"]*logo[^"]*"[^>]*>[\s\S]*?<\/[^>]*>/gi) || [];
    samples.push(...logoMatches.slice(0, 3));
    
    // Primary buttons and CTAs
    const buttonMatches = this.html.match(/<(?:button|a)[^>]*class="[^"]*(?:btn-primary|primary|cta|call-to-action)[^"]*"[^>]*>[\s\S]*?<\/(?:button|a)>/gi) || [];
    samples.push(...buttonMatches.slice(0, 5));
    
    // SVG elements
    const svgMatches = this.html.match(/<svg[^>]*>[\s\S]*?<\/svg>/gi) || [];
    samples.push(...svgMatches.slice(0, 10));
    
    // Style blocks
    const styleMatches = this.html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
    samples.push(...styleMatches.slice(0, 3));
    
    const combined = samples.join('\n\n');
    return combined.length > 8000 ? combined.substring(0, 8000) + '\n...[truncated]' : combined;
  }

  async callOpenAI(prompt) {
    const apiKey = this.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'test-key') {
      // Mock response for testing without API key
      return {
        primary: "#ff0000",
        confidence: "medium",
        reasoning: "Mock response - API key not available"
      };
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
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
        temperature: 0.1,
        max_tokens: 500,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No content in OpenAI response");
    }

    return JSON.parse(content);
  }

  isValidColor(color) {
    if (!color) return false;
    const cleanColor = color.trim();
    return cleanColor.match(/^#[0-9a-fA-F]{3,8}$/);
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
    console.log(`\n🤖 Testing LLM extraction for ${domain}...`);
    
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
    
    const extractor = new BrandColorExtractor(domain, html, mockEnv);
    const colors = await extractor.extractColors();
    
    return { colors, methodsUsed: extractor.getMethodsUsed() };
    
  } catch (error) {
    console.error(`❌ Error testing ${domain}:`, error.message);
    return null;
  }
}

async function runTests() {
  console.log('🤖 LLM-Powered Color Extraction Test Suite');
  console.log('==========================================');
  
  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠️  No OPENAI_API_KEY found - using mock responses');
  }
  
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
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // Longer delay for API calls
  }
  
  console.log('\n🏁 LLM test completed!');
}

runTests().catch(console.error);

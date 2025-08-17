#!/usr/bin/env node

// Simple test script to verify color extraction
const testDomains = [
  { domain: 'mistral.ai', expected: '#e00400' },
  { domain: 'github.com', expected: '#238636' },
  { domain: 'stripe.com', expected: '#635bff' },
  { domain: 'deco.cx', expected: '#d0ec1a' }
];

// Simulate the color extraction logic (simplified version for testing)
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
    
    // Test different extraction methods
    const results = {
      metaTheme: extractMetaThemeColor(html),
      svgFills: extractSvgFills(html),
      cssVars: extractCssVariables(html),
      frequentColors: extractFrequentColors(html)
    };
    
    console.log('📊 Extraction Results:');
    Object.entries(results).forEach(([method, colors]) => {
      if (colors.length > 0) {
        console.log(`  ${method}: ${colors.slice(0, 3).join(', ')}`);
      }
    });
    
    return results;
    
  } catch (error) {
    console.error(`❌ Error testing ${domain}:`, error.message);
    return null;
  }
}

function extractMetaThemeColor(html) {
  const match = html.match(/<meta\s+name=["']theme-color["']\s+content=["']([^"']+)["']/i);
  return match ? [match[1]] : [];
}

function extractSvgFills(html) {
  const matches = html.match(/fill=["']#[0-9a-fA-F]{6}["']/gi) || [];
  return matches.map(m => m.match(/#[0-9a-fA-F]{6}/)[0].toLowerCase())
    .filter((color, index, arr) => arr.indexOf(color) === index); // unique
}

function extractCssVariables(html) {
  const styleBlocks = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
  const cssText = styleBlocks.join('\n');
  
  const patterns = [
    /--[a-zA-Z0-9-_]*(?:brand|primary|main)[a-zA-Z0-9-_]*\s*:\s*(#[0-9a-fA-F]{6})/gi,
    /--[a-zA-Z0-9-_]*(?:color|accent)[a-zA-Z0-9-_]*\s*:\s*(#[0-9a-fA-F]{6})/gi
  ];
  
  const colors = [];
  patterns.forEach(pattern => {
    const matches = cssText.match(pattern) || [];
    matches.forEach(match => {
      const color = match.match(/#[0-9a-fA-F]{6}/);
      if (color) colors.push(color[0].toLowerCase());
    });
  });
  
  return [...new Set(colors)]; // unique
}

function extractFrequentColors(html) {
  const allColors = html.match(/#[0-9a-fA-F]{6}/g) || [];
  const frequency = {};
  
  allColors.forEach(color => {
    const normalized = color.toLowerCase();
    frequency[normalized] = (frequency[normalized] || 0) + 1;
  });
  
  return Object.entries(frequency)
    .filter(([color, count]) => count >= 2 && isVibrantColor(color))
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([color]) => color);
}

function isVibrantColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  const brightness = max / 255;
  
  // Check if it's not grayscale
  const isNeutral = Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && Math.abs(r - b) < 20;
  
  return saturation > 0.3 && brightness > 0.2 && brightness < 0.9 && !isNeutral;
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

// Main test function
async function runTests() {
  console.log('🎨 Color Extraction Test Suite');
  console.log('================================');
  
  for (const { domain, expected } of testDomains) {
    const results = await testColorExtraction(domain);
    
    if (results) {
      // Find the best match across all methods
      const allColors = [
        ...results.metaTheme,
        ...results.svgFills,
        ...results.cssVars,
        ...results.frequentColors
      ];
      
      let bestMatch = null;
      let bestDistance = Infinity;
      
      allColors.forEach(color => {
        const distance = colorDistance(color, expected);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestMatch = color;
        }
      });
      
      console.log(`\n📋 Results for ${domain}:`);
      console.log(`   Expected: ${expected}`);
      console.log(`   Best match: ${bestMatch || 'None found'}`);
      
      if (bestMatch) {
        const isClose = bestDistance < 50; // Within 50 RGB units
        const status = isClose ? '✅ CLOSE' : '❌ DIFFERENT';
        console.log(`   Distance: ${Math.round(bestDistance)} RGB units - ${status}`);
      } else {
        console.log(`   Status: ❌ NO BRAND COLOR FOUND`);
      }
    }
    
    // Add delay between requests to be respectful
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n🏁 Test completed!');
}

// Run the tests
runTests().catch(console.error);

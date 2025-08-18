#!/usr/bin/env node
/**
 * Demo script for theme extraction functionality
 * Run with: bun run packages/sdk/src/demo-theme-extractor.ts <url>
 */

import {
  extractThemeFromWebsite,
  generateThemeCSS,
  validateThemeAccessibility,
  type ThemeGenerationOptions,
} from "./theme-extractor.ts";

async function main() {
  const url = process.argv[2];
  
  if (!url) {
    console.log("Usage: bun run demo-theme-extractor.ts <website-url>");
    console.log("Example: bun run demo-theme-extractor.ts https://stripe.com");
    process.exit(1);
  }

  console.log(`🎨 Extracting theme from: ${url}\n`);

  try {
    // Test with default options
    const result = await extractThemeFromWebsite(url);
    
    console.log("📊 Extraction Results:");
    console.log(`   Company: ${result.companyName || "Unknown"}`);
    console.log(`   Theme: ${result.isDark ? "Dark" : "Light"}`);
    console.log(`   Primary: ${result.colors["--primary"]}`);
    console.log(`   Background: ${result.colors["--background"]}`);
    console.log(`   Brand Colors: ${result.brandColors.join(", ")}`);
    console.log(`   Dominant Colors: ${result.dominantColors.join(", ")}`);
    
    // Validate accessibility
    const validation = validateThemeAccessibility(result.colors);
    console.log(`\n♿ Accessibility: ${validation.isValid ? "✅ PASSED" : "❌ ISSUES"}`);
    if (!validation.isValid) {
      validation.issues.forEach(issue => console.log(`   - ${issue}`));
    }
    
    // Generate CSS output
    console.log("\n🎨 Generated CSS Theme:");
    console.log("```css");
    console.log(generateThemeCSS(result));
    console.log("```");
    
    // Test with dark theme forced
    console.log("\n🌙 Testing with forced dark theme:");
    const darkOptions: ThemeGenerationOptions = { preferDark: true };
    const darkResult = await extractThemeFromWebsite(url, darkOptions);
    console.log(`   Theme: ${darkResult.isDark ? "Dark" : "Light"}`);
    console.log(`   Primary: ${darkResult.colors["--primary"]}`);
    console.log(`   Background: ${darkResult.colors["--background"]}`);
    
  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

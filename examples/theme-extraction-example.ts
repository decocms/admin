/**
 * Theme Extraction Example
 * 
 * This example demonstrates how to use the theme extraction functionality
 * to extract colors from websites and generate complete theme palettes.
 */

import {
  extractThemeFromWebsite,
  generateThemeCSS,
  validateThemeAccessibility,
  generateAlgorithmicTheme,
  type ThemeGenerationOptions,
} from "@deco/sdk/theme-extractor";

async function demonstrateThemeExtraction() {
  console.log("🎨 Theme Extraction Examples\n");

  // Example 1: Extract theme from Stripe
  console.log("1. Extracting theme from Stripe...");
  try {
    const stripeTheme = await extractThemeFromWebsite("https://stripe.com");
    
    console.log(`   Company: ${stripeTheme.companyName}`);
    console.log(`   Theme Type: ${stripeTheme.isDark ? "Dark" : "Light"}`);
    console.log(`   Primary Color: ${stripeTheme.colors["--primary"]}`);
    console.log(`   Brand Colors: ${stripeTheme.brandColors.join(", ")}`);
    
    // Validate accessibility
    const validation = validateThemeAccessibility(stripeTheme.colors);
    console.log(`   Accessibility: ${validation.isValid ? "✅ PASSED" : "❌ ISSUES"}`);
    
    if (!validation.isValid) {
      validation.issues.forEach(issue => console.log(`     - ${issue}`));
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log();

  // Example 2: Force dark theme
  console.log("2. Generating dark theme for GitHub...");
  try {
    const options: ThemeGenerationOptions = { preferDark: true };
    const githubDarkTheme = await extractThemeFromWebsite("https://github.com", options);
    
    console.log(`   Theme Type: ${githubDarkTheme.isDark ? "Dark" : "Light"}`);
    console.log(`   Background: ${githubDarkTheme.colors["--background"]}`);
    console.log(`   Foreground: ${githubDarkTheme.colors["--foreground"]}`);
    console.log(`   Primary: ${githubDarkTheme.colors["--primary"]}`);
  } catch (error) {
    console.log(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log();

  // Example 3: Custom primary color
  console.log("3. Custom primary color theme...");
  try {
    const options: ThemeGenerationOptions = { primaryColor: "#ff6b6b" };
    const customTheme = await extractThemeFromWebsite("https://example.com", options);
    
    console.log(`   Primary Color: ${customTheme.colors["--primary"]}`);
    console.log(`   Primary Foreground: ${customTheme.colors["--primary-foreground"]}`);
    console.log(`   Success Color: ${customTheme.colors["--success"]}`);
    console.log(`   Warning Color: ${customTheme.colors["--warning"]}`);
  } catch (error) {
    console.log(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log();

  // Example 4: Generate algorithmic theme from single color
  console.log("4. Algorithmic theme generation...");
  const algorithmicTheme = generateAlgorithmicTheme("#2563eb");
  
  console.log(`   Theme Type: ${algorithmicTheme.isDark ? "Dark" : "Light"}`);
  console.log(`   Variables Count: ${Object.keys(algorithmicTheme.colors).length}`);
  console.log(`   Primary: ${algorithmicTheme.colors["--primary"]}`);
  console.log(`   Secondary: ${algorithmicTheme.colors["--secondary"]}`);

  console.log();

  // Example 5: Generate CSS output
  console.log("5. CSS Output Example:");
  const cssOutput = generateThemeCSS({
    companyName: "Example Co",
    colors: algorithmicTheme.colors,
    isDark: algorithmicTheme.isDark,
    dominantColors: ["#2563eb"],
    brandColors: ["#2563eb"],
  });
  
  console.log("```css");
  console.log(cssOutput.substring(0, 500) + "...");
  console.log("```");
}

// Run the examples
if (import.meta.main) {
  demonstrateThemeExtraction().catch(console.error);
}

export { demonstrateThemeExtraction };

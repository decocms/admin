# Theme Extractor

A powerful TypeScript library for extracting colors from websites and generating complete, accessible theme palettes.

## Features

- 🎨 **Color Extraction**: Extract prominent colors from any website URL
- 🤖 **Smart Theme Generation**: Create complete shadcn/ui compatible themes
- 🌓 **Dark/Light Detection**: Automatically determine optimal theme preference
- ♿ **Accessibility Validation**: Ensure WCAG AA contrast compliance
- 🛠️ **Multiple Output Formats**: JSON, CSS, or CSS variables
- 📱 **CLI Support**: Standalone command-line tool

## Installation

```bash
# Install the SDK package
bun add @deco/sdk

# Or use the CLI directly
npx @deco/cli extract-theme https://example.com
```

## Quick Start

### Basic Usage

```typescript
import { extractThemeFromWebsite } from "@deco/sdk/theme-extractor";

// Extract theme from any website
const result = await extractThemeFromWebsite("https://stripe.com");

console.log(result.companyName); // "Stripe"
console.log(result.isDark); // false
console.log(result.colors["--primary"]); // "#635bff"
```

### Generate CSS

```typescript
import {
  extractThemeFromWebsite,
  generateThemeCSS,
} from "@deco/sdk/theme-extractor";

const result = await extractThemeFromWebsite("https://github.com");
const css = generateThemeCSS(result);

console.log(css);
// :root {
//   --background: #ffffff;
//   --foreground: #24292f;
//   --primary: #0969da;
//   ...
// }
```

### Validate Accessibility

```typescript
import {
  extractThemeFromWebsite,
  validateThemeAccessibility,
} from "@deco/sdk/theme-extractor";

const result = await extractThemeFromWebsite("https://example.com");
const validation = validateThemeAccessibility(result.colors);

if (!validation.isValid) {
  console.log("Accessibility issues:", validation.issues);
}
```

## API Reference

### `extractThemeFromWebsite(url, options?)`

Extract colors and generate a complete theme from a website.

**Parameters:**

- `url` (string): Website URL to analyze
- `options` (ThemeGenerationOptions, optional): Generation options

**Returns:** `Promise<ColorExtractionResult>`

```typescript
interface ColorExtractionResult {
  companyName?: string;
  favicon?: string;
  logo?: string;
  colors: Record<string, string>; // All theme CSS variables
  isDark: boolean; // Whether theme is dark
  dominantColors: string[]; // Main colors found on site
  brandColors: string[]; // Vibrant brand colors
}

interface ThemeGenerationOptions {
  preferDark?: boolean; // Force dark theme
  primaryColor?: string; // Override primary color
  useAlgorithmicOnly?: boolean; // Skip LLM generation
}
```

### Color Utility Functions

```typescript
import {
  getLuminance,
  getContrastRatio,
  isLightColor,
  adjustColorBrightness,
} from "@deco/sdk/theme-extractor";

// Check color properties
const luminance = getLuminance("#2563eb"); // 0.123
const isLight = isLightColor("#ffffff"); // true
const contrast = getContrastRatio("#000", "#fff"); // 21

// Modify colors
const lighter = adjustColorBrightness("#2563eb", 0.2); // Lighter
const darker = adjustColorBrightness("#2563eb", -0.2); // Darker
```

### Theme Generation

```typescript
import { generateAlgorithmicTheme } from "@deco/sdk/theme-extractor";

// Generate theme from a single color
const { colors, isDark } = generateAlgorithmicTheme("#2563eb", {
  preferDark: false,
});
```

## CLI Usage

The theme extractor includes a powerful CLI tool:

```bash
# Basic extraction
deco extract-theme https://stripe.com

# Output to file
deco extract-theme https://github.com --output theme.css --format css

# Force dark theme with custom primary
deco extract-theme https://example.com --dark --primary "#ff6b6b"

# Validate accessibility
deco extract-theme https://tailwindcss.com --validate --verbose

# Output only CSS variables
deco extract-theme https://vercel.com --format variables
```

### CLI Options

- `-o, --output <path>`: Output file path
- `-f, --format <format>`: Output format (json, css, variables)
- `--dark`: Force dark theme generation
- `--light`: Force light theme generation
- `-p, --primary <color>`: Override primary color
- `--validate`: Validate theme for accessibility
- `-v, --verbose`: Show verbose output

## Generated Theme Variables

The extractor generates all shadcn/ui compatible CSS variables:

```css
:root {
  /* Base colors */
  --background: #ffffff;
  --foreground: #0a0a0a;
  --card: #ffffff;
  --card-foreground: #0a0a0a;
  --popover: #ffffff;
  --popover-foreground: #0a0a0a;

  /* Brand colors */
  --primary: #2563eb;
  --primary-foreground: #ffffff;
  --primary-light: #3b82f6;
  --primary-dark: #1d4ed8;

  /* UI colors */
  --secondary: #f1f5f9;
  --secondary-foreground: #0f172a;
  --muted: #f1f5f9;
  --muted-foreground: #64748b;
  --accent: #f1f5f9;
  --accent-foreground: #0f172a;

  /* Semantic colors */
  --destructive: #dc2626;
  --destructive-foreground: #ffffff;
  --success: #16a34a;
  --success-foreground: #ffffff;
  --warning: #ea580c;
  --warning-foreground: #ffffff;

  /* Borders and inputs */
  --border: #e2e8f0;
  --input: #e2e8f0;
  --sidebar: #f8fafc;
}
```

## Color Extraction Process

1. **Website Analysis**: Fetches HTML and extracts colors from:
   - CSS stylesheets and inline styles
   - Image metadata (favicon, logos)
   - Brand elements and design tokens

2. **Color Processing**:
   - Filters out common colors (black, white, gray)
   - Identifies vibrant brand colors
   - Sorts by color vibrancy and contrast

3. **Theme Generation**:
   - Determines dark/light preference based on primary color luminance
   - Generates semantic color roles (success, warning, destructive)
   - Ensures WCAG AA contrast compliance
   - Creates complete shadcn/ui variable set

4. **Validation**:
   - Checks contrast ratios for accessibility
   - Validates color harmony and consistency
   - Provides improvement suggestions

## Examples

### Extract Stripe's Theme

```typescript
const stripeTheme = await extractThemeFromWebsite("https://stripe.com");
console.log(stripeTheme.colors["--primary"]); // "#635bff"
```

### GitHub Dark Theme

```typescript
const githubTheme = await extractThemeFromWebsite("https://github.com", {
  preferDark: true,
});
console.log(githubTheme.isDark); // true
```

### Custom Primary Color

```typescript
const customTheme = await extractThemeFromWebsite("https://example.com", {
  primaryColor: "#ff6b6b",
});
```

## Demo Script

Test the functionality with the included demo:

````bash
# Run demo script
bun run packages/sdk/src/demo-theme-extractor.ts https://stripe.com

# Example output:
# 🎨 Extracting theme from: https://stripe.com
#
# 📊 Extraction Results:
#    Company: Stripe
#    Theme: Light
#    Primary: #635bff
#    Background: #ffffff
#    Brand Colors: #635bff, #00d924, #ff5a00
#
# ♿ Accessibility: ✅ PASSED
#
# 🎨 Generated CSS Theme:
# ```css
# :root {
#   --background: #ffffff;
#   --foreground: #0a0a0a;
#   --primary: #635bff;
#   ...
# }
# ```
````

## Integration with deco.chat

This theme extractor is used in deco.chat's onboarding flow to automatically generate branded themes for new workspaces. The extracted themes maintain brand consistency while ensuring accessibility and usability.

## Error Handling

The library includes robust error handling:

- **Network failures**: Graceful fallbacks with generated colors
- **Invalid URLs**: Clear error messages with suggestions
- **Parsing errors**: Default color palettes when extraction fails
- **Accessibility issues**: Warnings with specific improvement guidance

## Browser Compatibility

Works in all modern environments:

- ✅ Node.js 18+
- ✅ Bun runtime
- ✅ Browser environments (with CORS considerations)
- ✅ Edge functions and serverless environments

## Contributing

The theme extractor is part of the deco.chat monorepo. To contribute:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure accessibility compliance
5. Submit a pull request

## License

MIT License - see the main repository for details.

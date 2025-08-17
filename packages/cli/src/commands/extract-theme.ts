import { Command } from "commander";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import {
  extractThemeFromWebsite,
  generateThemeCSS,
  generateCSSVariables,
  validateThemeAccessibility,
  type ColorExtractionResult,
  type ThemeGenerationOptions,
} from "@deco/sdk/theme-extractor";

interface ExtractThemeOptions {
  output?: string;
  format: "json" | "css" | "variables";
  dark?: boolean;
  light?: boolean;
  primary?: string;
  validate?: boolean;
  verbose?: boolean;
}

export function createExtractThemeCommand(): Command {
  const command = new Command("extract-theme");

  command
    .description("Extract colors from a website and generate a complete theme")
    .argument("<url>", "Website URL to extract colors from")
    .option("-o, --output <path>", "Output file path")
    .option("-f, --format <format>", "Output format: json, css, variables", "json")
    .option("--dark", "Force dark theme generation")
    .option("--light", "Force light theme generation")
    .option("-p, --primary <color>", "Override primary color (hex format)")
    .option("--validate", "Validate theme for accessibility")
    .option("-v, --verbose", "Show verbose output")
    .action(async (url: string, options: ExtractThemeOptions) => {
      try {
        if (options.verbose) {
          console.log(`🎨 Extracting theme from: ${url}`);
        }

        // Validate URL
        if (!isValidUrl(url)) {
          console.error("❌ Invalid URL provided");
          process.exit(1);
        }

        // Build theme generation options
        const themeOptions: ThemeGenerationOptions = {};
        
        if (options.dark && options.light) {
          console.error("❌ Cannot specify both --dark and --light options");
          process.exit(1);
        }
        
        if (options.dark) {
          themeOptions.preferDark = true;
        } else if (options.light) {
          themeOptions.preferDark = false;
        }
        
        if (options.primary) {
          if (!isValidHexColor(options.primary)) {
            console.error("❌ Primary color must be a valid hex color (e.g., #2563eb)");
            process.exit(1);
          }
          themeOptions.primaryColor = options.primary;
        }

        // Extract theme
        const result = await extractThemeFromWebsite(url, themeOptions);

        if (options.verbose) {
          console.log(`✅ Extracted theme for: ${result.companyName || url}`);
          console.log(`🎯 Primary color: ${result.colors["--primary"]}`);
          console.log(`🌓 Theme type: ${result.isDark ? "Dark" : "Light"}`);
          console.log(`🎨 Colors extracted: ${result.brandColors.length} brand, ${result.dominantColors.length} dominant`);
        }

        // Validate accessibility if requested
        if (options.validate) {
          const validation = validateThemeAccessibility(result.colors);
          if (validation.isValid) {
            console.log("✅ Theme passes WCAG AA accessibility standards");
          } else {
            console.log("⚠️  Theme accessibility issues:");
            validation.issues.forEach(issue => console.log(`   - ${issue}`));
          }
        }

        // Generate output
        const output = generateOutput(result, options.format);
        
        // Write to file or stdout
        if (options.output) {
          await ensureDirectoryExists(options.output);
          await writeFile(options.output, output, "utf8");
          console.log(`📄 Theme saved to: ${options.output}`);
        } else {
          console.log(output);
        }

      } catch (error) {
        console.error("❌ Failed to extract theme:");
        if (error instanceof Error) {
          console.error(`   ${error.message}`);
        } else {
          console.error(`   ${String(error)}`);
        }
        
        if (options.verbose && error instanceof Error && error.stack) {
          console.error("\nStack trace:");
          console.error(error.stack);
        }
        
        process.exit(1);
      }
    });

  return command;
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url.startsWith("http") ? url : `https://${url}`);
    return true;
  } catch {
    return false;
  }
}

function isValidHexColor(color: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(color);
}

function generateOutput(result: ColorExtractionResult, format: string): string {
  switch (format) {
    case "css":
      return generateThemeCSS(result);
    
    case "variables":
      return generateCSSVariables(result.colors);
    
    case "json":
    default:
      return JSON.stringify(result, null, 2);
  }
}

async function ensureDirectoryExists(filePath: string): Promise<void> {
  const dir = join(filePath, "..");
  try {
    await mkdir(dir, { recursive: true });
  } catch (error) {
    // Directory might already exist, ignore error
  }
}

// Examples for help text
command.addHelpText('after', `
Examples:
  $ deco extract-theme https://example.com
  $ deco extract-theme example.com --format css --output theme.css
  $ deco extract-theme https://github.com --dark --primary "#2563eb"
  $ deco extract-theme https://stripe.com --validate --verbose
  $ deco extract-theme https://tailwindcss.com --format variables
`);

export default createExtractThemeCommand;

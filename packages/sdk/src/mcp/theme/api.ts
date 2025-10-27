import { z } from "zod";
import type { Json } from "../../storage/index.ts";
import type { Theme } from "../../theme.ts";
import { assertHasLocator, assertTeamResourceAccess } from "../assertions.ts";
import { createToolGroup } from "../context.ts";
import { mergeThemes } from "../teams/merge-theme.ts";
import { organizations } from "../schema.ts";
import { eq } from "drizzle-orm";
import { Locator } from "../../locator.ts";

// Enhanced theme schema with detailed context for AI tools
export const themeVariablesSchema = z.lazy(() =>
  z.object({
    "--background": z
      .string()
      .optional()
      .describe("Main background color of the application (OKLCH/hex format)"),
    "--foreground": z
      .string()
      .optional()
      .describe("Main text color on background (OKLCH/hex format)"),
    "--card": z
      .string()
      .optional()
      .describe("Background color for cards and panels (OKLCH/hex format)"),
    "--card-foreground": z
      .string()
      .optional()
      .describe("Text color on cards and panels (OKLCH/hex format)"),
    "--popover": z
      .string()
      .optional()
      .describe(
        "Background color for popovers and dropdowns (OKLCH/hex format)",
      ),
    "--popover-foreground": z
      .string()
      .optional()
      .describe("Text color in popovers and dropdowns (OKLCH/hex format)"),
    "--primary": z
      .string()
      .optional()
      .describe(
        "Primary brand color for buttons and highlights (OKLCH/hex format)",
      ),
    "--primary-foreground": z
      .string()
      .optional()
      .describe("Text color on primary elements (OKLCH/hex format)"),
    "--secondary": z
      .string()
      .optional()
      .describe(
        "Secondary color for less prominent elements (OKLCH/hex format)",
      ),
    "--secondary-foreground": z
      .string()
      .optional()
      .describe("Text color on secondary elements (OKLCH/hex format)"),
    "--muted": z
      .string()
      .optional()
      .describe(
        "Muted background color for subtle elements (OKLCH/hex format)",
      ),
    "--muted-foreground": z
      .string()
      .optional()
      .describe("Muted text color for secondary text (OKLCH/hex format)"),
    "--accent": z
      .string()
      .optional()
      .describe("Accent color for interactive elements (OKLCH/hex format)"),
    "--accent-foreground": z
      .string()
      .optional()
      .describe("Text color on accent elements (OKLCH/hex format)"),
    "--destructive": z
      .string()
      .optional()
      .describe("Color for destructive actions and errors (OKLCH/hex format)"),
    "--destructive-foreground": z
      .string()
      .optional()
      .describe("Text color on destructive elements (OKLCH/hex format)"),
    "--success": z
      .string()
      .optional()
      .describe(
        "Color for success states and positive actions (OKLCH/hex format)",
      ),
    "--success-foreground": z
      .string()
      .optional()
      .describe("Text color on success elements (OKLCH/hex format)"),
    "--warning": z
      .string()
      .optional()
      .describe(
        "Color for warning states and caution indicators (OKLCH/hex format)",
      ),
    "--warning-foreground": z
      .string()
      .optional()
      .describe("Text color on warning elements (OKLCH/hex format)"),
    "--border": z
      .string()
      .optional()
      .describe("Border color for elements (OKLCH/hex format)"),
    "--input": z
      .string()
      .optional()
      .describe("Border color for input fields (OKLCH/hex format)"),
    "--sidebar": z
      .string()
      .optional()
      .describe("Background color for sidebar navigation (OKLCH/hex format)"),
    "--sidebar-foreground": z
      .string()
      .optional()
      .describe("Text color in sidebar navigation (OKLCH/hex format)"),
    "--sidebar-accent": z
      .string()
      .optional()
      .describe(
        "Accent background color for sidebar elements (OKLCH/hex format)",
      ),
    "--sidebar-accent-foreground": z
      .string()
      .optional()
      .describe("Text color on sidebar accent elements (OKLCH/hex format)"),
    "--sidebar-border": z
      .string()
      .optional()
      .describe("Border color for sidebar elements (OKLCH/hex format)"),
    "--sidebar-ring": z
      .string()
      .optional()
      .describe("Focus ring color for sidebar elements (OKLCH/hex format)"),
    "--radius": z
      .string()
      .optional()
      .describe("Border radius for UI elements (e.g., '0.625rem')"),
    "--spacing": z
      .string()
      .optional()
      .describe("Base spacing unit for layout (e.g., '0.25rem')"),
  }),
);

const fontSchema = z.union([
  z.object({
    type: z.literal("Google Fonts").describe("Use a Google Fonts font"),
    name: z
      .string()
      .describe(
        "Name of the Google Font (e.g., 'Inter', 'Roboto', 'Open Sans')",
      ),
  }),
  z.object({
    type: z.literal("Custom").describe("Use a custom uploaded font"),
    name: z.string().describe("Display name for the custom font"),
    url: z.string().describe("URL to the custom font file"),
  }),
]);

export const enhancedThemeSchema = z
  .object({
    variables: themeVariablesSchema
      .optional()
      .describe(
        "CSS custom properties for theme colors. Use OKLCH format (preferred) or hex colors.",
      ),
    picture: z.string().optional().describe("URL to team avatar/logo image"),
    font: fontSchema
      .optional()
      .describe("Font configuration for the workspace"),
  })
  .describe(
    "Theme configuration for the workspace. Only include the properties you want to change - existing values will be preserved.",
  );

// Register the Theme tools under a dedicated group id so they surface as integration id `i:theme-management`
export const createTool = createToolGroup("Theme", {
  name: "Theme Management",
  description: "Manage organization-level themes and workspace branding.",
  icon: "https://assets.decocache.com/mcp/42dcf0d2-5a2f-4d50-87a6-0e9ebaeae9b5/Agent-Setup.png",
});

export const updateOrgTheme = createTool({
  name: "UPDATE_ORG_THEME",
  description:
    "Update the organization-level theme in database. Merges with existing theme. Uses current organization in context.",
  inputSchema: z.object({
    theme: enhancedThemeSchema.describe("Theme configuration to apply"),
  }),
  outputSchema: z.object({
    theme: enhancedThemeSchema,
  }),
  handler: async (props, c) => {
    assertHasLocator(c);

    const { org } = Locator.parse(c.locator.value);
    if (!org || org === "shared" || org === "users") {
      throw new Error("No organization slug in context");
    }

    // Use TEAMS_UPDATE permission since updating org theme is part of team management
    await assertTeamResourceAccess("TEAMS_UPDATE", org, c);

    // Get current theme to merge
    const currentResult = await c.drizzle
      .select({ theme: organizations.theme })
      .from(organizations)
      .where(eq(organizations.slug, org))
      .limit(1);

    if (!currentResult || currentResult.length === 0) {
      throw new Error("Organization not found");
    }

    const currentTheme = currentResult[0].theme as Json | null;
    const mergedTheme = mergeThemes(currentTheme, props.theme);

    // Update the organization and return the updated record
    const updatedResult = await c.drizzle
      .update(organizations)
      .set({ theme: mergedTheme as Json })
      .where(eq(organizations.slug, org))
      .returning({ theme: organizations.theme });

    if (!updatedResult || updatedResult.length === 0) {
      throw new Error("Failed to update organization theme");
    }

    return { theme: updatedResult[0].theme as Theme };
  },
});

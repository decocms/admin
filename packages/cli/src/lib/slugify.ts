import { slugify as baseSlugify } from "@deco/sdk/memory";

/**
 * Converts a string into a URL-safe slug.
 * - Lowercases the string
 * - Replaces spaces and underscores with dashes
 * - Removes non-alphanumeric characters (except dashes)
 * - Trims leading/trailing dashes
 *
 * @param input - The string to slugify
 * @returns The slugified string
 */
export function slugify(input: string): string {
  return baseSlugify(input, { case: 'lower', separator: '-' });
}

export function sanitizeConstantName(input: string): string {
  return input
    .toUpperCase()
    .replace(/[\s_]+/g, "_") // Replace spaces and underscores with underscores
    .replace(/[^A-Z0-9_]/g, "") // Remove all non-alphanumeric except underscores
    .replace(/_+/g, "_") // Collapse multiple underscores
    .replace(/^_+|_+$/g, ""); // Trim leading/trailing underscores
}

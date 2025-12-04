/**
 * Convert a string to a URL-friendly slug
 * Removes special characters, converts to lowercase, and replaces spaces with hyphens
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_-]+/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

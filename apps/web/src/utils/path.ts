/**
 * Check if a string is a valid URL or data URI
 * Uses URL.canParse() when available, falls back to regex for broader compatibility
 */
function isUrlLike(path?: string): boolean {
  if (!path) return false;

  // Handle data URIs
  if (path.startsWith("data:")) return true;

  // Try URL.canParse() first (modern browsers)
  if (typeof URL !== "undefined" && "canParse" in URL) {
    try {
      return URL.canParse(path);
    } catch {
      return false;
    }
  }

  // Fallback to regex for broader compatibility
  return /^(https?:)|(ftp:)|(file:)|(blob:)/.test(path);
}

/**
 * Check if a string is a file path
 */
export function isFilePath(path?: string): boolean {
  if (!path) return false;
  return !isUrlLike(path);
}

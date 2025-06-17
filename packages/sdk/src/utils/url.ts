/**
 * Extract the file path from a signed URL or URI
 * Example: https://example.com/uploads/image.png?params... -> uploads/image.png
 */
export function extractPathFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove leading slash and return the path
    return urlObj.pathname.startsWith("/")
      ? urlObj.pathname.slice(1)
      : urlObj.pathname;
  } catch (_e: unknown) {
    throw new Error(`Invalid URL: ${url}`);
  }
}

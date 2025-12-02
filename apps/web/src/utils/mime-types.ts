/**
 * MIME type utilities for file handling
 */

/**
 * Map of file extensions to MIME types
 */
const EXTENSION_TO_MIME: Record<string, string> = {
  // Images
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",

  // Documents
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",

  // Text
  txt: "text/plain",
  csv: "text/csv",
  html: "text/html",
  htm: "text/html",

  // Data
  json: "application/json",

  // Media
  mp4: "video/mp4",
  mp3: "audio/mpeg",
  wav: "audio/wav",

  // Archives
  zip: "application/zip",
  rar: "application/x-rar-compressed",
  tar: "application/x-tar",
  gz: "application/gzip",
};

/**
 * Gets MIME type from file extension
 */
export function getMimeTypeFromExtension(extension: string): string {
  const normalizedExt = extension.toLowerCase().replace(/^\./, "");
  return EXTENSION_TO_MIME[normalizedExt] || "application/octet-stream";
}

/**
 * Gets MIME type from file path or URL
 */
export function getMimeTypeFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return getMimeTypeFromExtension(ext);
}

/**
 * Extracts content type from a data URL
 * Example: "data:image/png;base64,..." -> "image/png"
 */
export function extractContentTypeFromDataUrl(
  dataUrl: string,
): string | undefined {
  if (!dataUrl.startsWith("data:")) {
    return undefined;
  }

  const match = dataUrl.match(/^data:([^;,]+)/);
  return match?.[1];
}

/**
 * Gets content type from various sources with fallback
 * Tries in order:
 * 1. Explicit contentType parameter
 * 2. Extract from data URL
 * 3. Infer from file path/URL
 * 4. Falls back to "application/octet-stream"
 */
export function getContentType(
  url: string,
  explicitContentType?: string,
): string {
  if (explicitContentType) {
    return explicitContentType;
  }

  if (url.startsWith("data:")) {
    return extractContentTypeFromDataUrl(url) || "application/octet-stream";
  }

  return getMimeTypeFromPath(url);
}

/**
 * Checks if a content type represents an image
 */
export function isImageContentType(contentType: string): boolean {
  return contentType.startsWith("image/");
}

/**
 * Checks if a content type represents a PDF
 */
export function isPdfContentType(contentType: string): boolean {
  return contentType === "application/pdf";
}

/**
 * Checks if a content type represents text or structured text data
 * Includes plain text, JSON, XML, and variants
 */
export function isTextContentType(contentType: string): boolean {
  return (
    contentType.startsWith("text/") ||
    contentType === "application/json" ||
    contentType.endsWith("+json") ||
    contentType.endsWith("+xml") ||
    contentType === "application/xml"
  );
}

/**
 * Checks if a media type (from File part) represents an image
 */
export function isImageMediaType(mediaType?: string): boolean {
  return mediaType?.startsWith("image/") ?? false;
}

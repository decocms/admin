/**
 * Generates a bucket name for a workspace
 * @param workspaceValue The workspace value
 * @returns Normalized bucket name
 */
export function getWorkspaceBucketName(workspaceValue: string): string {
  return `deco-chat-${
    workspaceValue
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
  }`;
}

/**
 * Determines Content-Type based on file extension
 * @param path File path
 * @returns MIME type string
 */
export function getContentTypeFromPath(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase();

  const mimeTypes: Record<string, string> = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "webp": "image/webp",
    "svg": "image/svg+xml",
    "bmp": "image/bmp",
    "ico": "image/x-icon",
    "pdf": "application/pdf",
    "txt": "text/plain",
    "json": "application/json",
    "xml": "application/xml",
    "html": "text/html",
    "css": "text/css",
    "js": "application/javascript",
    "ts": "application/typescript",
  };

  return mimeTypes[extension || ""] || "application/octet-stream";
}

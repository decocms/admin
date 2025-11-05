const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F]/;

export const IMPORT_ARCHIVE_SIZE_LIMIT_BYTES = 25 * 1024 * 1024; // 25MB
export const IMPORT_FILE_SIZE_LIMIT_BYTES = 5 * 1024 * 1024; // 5MB per file
export const IMPORT_MAX_FILE_COUNT = 2000;

/**
 * Normalize a project file path extracted from an archive.
 * Returns the sanitized relative path or null when the path is unsafe.
 */
export function sanitizeProjectPath(rawPath: string): string | null {
  if (!rawPath) {
    return null;
  }

  const trimmed = rawPath.trim();
  if (!trimmed) {
    return null;
  }

  let normalized = trimmed.replace(/\\/g, "/");

  // Remove archive root prefixes such as "./" or leading slashes
  normalized = normalized.replace(/^\.\/+/, "");
  normalized = normalized.replace(/^\/+/, "");

  if (!normalized) {
    return null;
  }

  if (normalized.includes("..")) {
    return null;
  }

  if (CONTROL_CHARS_REGEX.test(normalized)) {
    return null;
  }

  return normalized;
}

/**
 * Encode a Uint8Array into a base64 string without exhausting the stack.
 */
export function encodeBytesToBase64(bytes: Uint8Array): string {
  const maybeBuffer = (
    globalThis as {
      Buffer?: {
        from(data: Uint8Array): { toString(encoding: string): string };
      };
    }
  ).Buffer;

  if (maybeBuffer) {
    return maybeBuffer.from(bytes).toString("base64");
  }

  let binary = "";
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

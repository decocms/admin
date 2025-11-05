export const IMPORT_ARCHIVE_SIZE_LIMIT_BYTES = 25 * 1024 * 1024; // 25MB
export const IMPORT_FILE_SIZE_LIMIT_BYTES = 5 * 1024 * 1024; // 5MB per file
export const IMPORT_MAX_FILE_COUNT = 2000;

// Check for disallowed ASCII control characters
function containsControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if ((code >= 0 && code <= 0x1f) || code === 0x7f) {
      return true;
    }
  }
  return false;
}

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

  if (containsControlCharacters(normalized)) {
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

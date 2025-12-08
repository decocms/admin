
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

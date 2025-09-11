import { createHash } from "node:crypto";

/**
 * Transforms a string into a unique alphanumeric identifier.
 * The resulting string will:
 * 1. Only contain alphanumeric characters
 * 2. Be unique for different inputs
 * 3. Be deterministic (same input always produces same output)
 * 4. Preserve some readability of the original string
 */
export function toAlphanumericId(input: string): string {
  // First, convert the string to lowercase and remove all non-alphanumeric chars
  const baseSlug = input.toLowerCase().replace(/[^a-z0-9]/g, "");

  // Create a hash of the original input to ensure uniqueness
  const hash = createHash("sha256").update(input).digest("hex").slice(0, 8); // Take first 8 chars of hash

  // Combine the cleaned string with the hash
  // If baseSlug is empty, just return the hash
  return baseSlug ? `${baseSlug}-${hash}` : hash;
}

/** Implements the uuid package's v5 algorithm with URL namespace */
export async function generateUUIDv5(
  name: string,
  // URL namespace UUID: 6ba7b810-9dad-11d1-80b4-00c04fd430c8
  namespaceStr = "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
): Promise<string> {
  const namespace = new Uint8Array(
    namespaceStr
      .replace(/-/g, "")
      .match(/.{2}/g)!
      .map((byte) => parseInt(byte, 16)),
  );

  // Convert name to bytes
  const nameBytes = new TextEncoder().encode(name);

  // Create SHA-1 hash of namespace + name
  const data = new Uint8Array(namespace.length + nameBytes.length);
  data.set(namespace);
  data.set(nameBytes, namespace.length);

  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const hashArray = new Uint8Array(hashBuffer);

  // Set version bits (5) and variant bits (RFC 4122)
  hashArray[6] = (hashArray[6] & 0x0f) | 0x50; // Version 5
  hashArray[8] = (hashArray[8] & 0x3f) | 0x80; // Variant RFC 4122

  // Convert to UUID string format
  const hex = Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

/**
 * Slugifies a string to be used as a subdomain
 * @param name The name to slugify
 * @returns A slugified string
 */
export const slugifyForDNS = (name: string) => {
  // Lowercase and replace all non-alphanumeric with hyphens
  let slug = name.toLowerCase().replace(/[^a-z0-9]/g, "-");
  // Replace multiple hyphens with a single hyphen
  slug = slug.replace(/-+/g, "-");
  // Remove leading and trailing hyphens
  slug = slug.replace(/^-+|-+$/g, "");
  // Ensure max length of 63 characters (DNS subdomain limit)
  slug = slug.slice(0, 63);
  // If the result is empty, return a default value (e.g., "subdomain")
  return slug || "subdomain";
};

/**
 * Configuration options for slugify function
 */
export interface SlugifyOptions {
  /** Case transformation: 'lower', 'upper', or 'preserve' */
  case?: 'lower' | 'upper' | 'preserve';
  /** Separator character to use for replacing non-alphanumeric characters */
  separator?: '-' | '_';
  /** If true, removes all non-alphanumeric characters completely */
  alphanumericOnly?: boolean;
}

/**
 * Unified slugify function that handles different casing and separator requirements.
 * @param input The string to slugify.
 * @param options Configuration options for slugification.
 * @returns The slugified string.
 */
export function slugify(input: string, options: SlugifyOptions = {}): string {
  const {
    case: caseTransform = 'lower',
    separator = '-',
    alphanumericOnly = false,
  } = options;

  let result = input.trim();

  // Apply case transformation first
  switch (caseTransform) {
    case 'lower':
      result = result.toLowerCase();
      break;
    case 'upper':
      result = result.toUpperCase();
      break;
    case 'preserve':
      // Keep original case
      break;
  }

  if (alphanumericOnly) {
    // Remove all non-alphanumeric characters
    result = result.replace(/[^a-zA-Z0-9]/g, '');
  } else {
    // Replace spaces, dashes, underscores, dots, slashes with separator
    result = result.replace(/[\s_\-/.]+/g, separator);
    
    // Remove all other non-alphanumeric characters (except our separator)
    const separatorRegex = separator === '-' 
      ? /[^a-zA-Z0-9\-]/g 
      : /[^a-zA-Z0-9_]/g;
    result = result.replace(separatorRegex, '');
    
    // Collapse multiple separators
    const multipleSeparatorRegex = separator === '-' ? /-+/g : /_+/g;
    result = result.replace(multipleSeparatorRegex, separator);
    
    // Remove leading/trailing separators
    const trimRegex = separator === '-' 
      ? /^-+|-+$/g 
      : /^_+|_+$/g;
    result = result.replace(trimRegex, '');
  }

  return result;
}

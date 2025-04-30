/**
 * Transforms a string into a unique alphanumeric identifier.
 * The resulting string will:
 * 1. Only contain alphanumeric characters
 * 2. Be unique for different inputs
 * 3. Be deterministic (same input always produces same output)
 * 4. Preserve some readability of the original string
 */
export async function toAlphanumericId(input: string): Promise<string> {
  // First, convert the string to lowercase and remove all non-alphanumeric chars
  const baseSlug = input.toLowerCase().replace(/[^a-z0-9]/g, "");

  // Create a hash of the original input to ensure uniqueness using Web Crypto API
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
    .slice(0, 8);

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

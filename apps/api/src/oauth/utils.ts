/**
 * Generate a cryptographically secure random token
 */
export function generateRandomToken(length = 32): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join("");
}

/**
 * Hash a PKCE code verifier using SHA-256 and return base64url encoded string
 */
export async function hashPKCE(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);

  // Convert to base64url
  const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Validate that a redirect URI is in the list of registered URIs
 */
export function validateRedirectUri(
  uri: string,
  registered: string[],
): boolean {
  return registered.includes(uri);
}

/**
 * Validate that a redirect URI is either HTTPS, localhost, or a custom scheme
 * OAuth 2.1 allows custom URI schemes for native apps (like cursor://)
 */
export function isValidRedirectUriFormat(uri: string): boolean {
  try {
    const url = new URL(uri);
    return (
      url.protocol === "https:" ||
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      (url.protocol === "http:" &&
        (url.hostname === "localhost" || url.hostname === "127.0.0.1")) ||
      // Allow custom schemes for native apps (e.g., cursor://, vscode://, etc.)
      !url.protocol.startsWith("http")
    );
  } catch {
    return false;
  }
}

/**
 * Get current Unix timestamp in seconds
 */
export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Encode workspace context and client state into combined state parameter
 */
export function encodeOAuthState(data: {
  org?: string;
  project?: string;
  integrationId?: string;
  clientState?: string;
}): string {
  return btoa(JSON.stringify(data));
}

/**
 * Decode workspace context from state parameter
 */
export function decodeOAuthState(state: string): {
  org: string;
  project: string;
  integrationId: string;
  clientState?: string;
} | null {
  try {
    return JSON.parse(atob(state));
  } catch {
    return null;
  }
}

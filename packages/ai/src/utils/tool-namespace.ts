/**
 * Utility functions for namespacing tool names with integration IDs
 * Format: {integrationIdWithUnderscores}__{toolName}
 *
 * Integration IDs contain colons (e.g., "i:workspace-management"), which are not allowed
 * in tool names per AI SDK validation (pattern: ^[a-zA-Z0-9_-]{1,128}$).
 * So we replace colons with underscores in the integration ID and use double underscore as separator.
 *
 * IMPORTANT: OpenAI has a 64-character limit for tool names. To ensure compatibility while
 * avoiding ID collisions, we use a minimum of 16 characters for the integration ID prefix
 * (or the full ID if shorter), leaving 46 characters for tool names.
 *
 * For tool names + prefix that exceed 64 chars, we truncate the prefix further as needed.
 */

const NAMESPACE_SEPARATOR = "__";
// OpenAI's maximum tool name length
const MAX_TOOL_NAME_LENGTH = 64;
// Minimum prefix length to avoid collisions (16 chars provides good uniqueness)
const MIN_PREFIX_LENGTH = 16;
// Maximum prefix length we'll use (if space allows)
const MAX_PREFIX_LENGTH = 24;

/**
 * Shortens an integration ID to fit within the given length limit
 * @param integrationId - The integration ID to shorten
 * @param maxLength - Maximum allowed length for the prefix
 * @returns Shortened integration ID that fits within maxLength
 */
function shortenIntegrationId(
  integrationId: string,
  maxLength: number,
): string {
  if (integrationId.length <= maxLength) {
    return integrationId;
  }

  // Truncate to the specified length
  // For 16 chars: provides 36^16 combinations (extremely unlikely to collide)
  return integrationId.substring(0, maxLength);
}

/**
 * Format a tool name with its integration ID as a namespace
 * @param integrationId - The integration ID (e.g., "i:workspace-management" or "a:uuid")
 * @param toolName - The original tool name
 * @returns Namespaced tool name in format {integrationId}__{toolName}
 * @throws Error if the tool name is too long to fit even with minimum prefix
 */
export function formatToolName(
  integrationId: string,
  toolName: string,
): string {
  // Replace colons with underscores to comply with tool name validation pattern
  const sanitizedIntegrationId = integrationId.replace(/:/g, "_");

  // Calculate available space for prefix
  const spaceForPrefix =
    MAX_TOOL_NAME_LENGTH - NAMESPACE_SEPARATOR.length - toolName.length;

  // Check if tool name is too long even with minimum prefix
  if (spaceForPrefix < MIN_PREFIX_LENGTH) {
    const maxAllowedToolNameLength =
      MAX_TOOL_NAME_LENGTH - MIN_PREFIX_LENGTH - NAMESPACE_SEPARATOR.length;
    throw new Error(
      `Tool name "${toolName}" is too long (${toolName.length} characters). ` +
        `Maximum allowed is ${maxAllowedToolNameLength} characters to accommodate integration ID prefix. ` +
        `Please shorten the tool name.`,
    );
  }

  // Use as much of the integration ID as we can, up to MAX_PREFIX_LENGTH
  const prefixLength = Math.min(spaceForPrefix, MAX_PREFIX_LENGTH);
  const shortId = shortenIntegrationId(sanitizedIntegrationId, prefixLength);

  const namespacedName = `${shortId}${NAMESPACE_SEPARATOR}${toolName}`;

  // Sanity check (should never fail due to our calculations above)
  if (namespacedName.length > MAX_TOOL_NAME_LENGTH) {
    throw new Error(
      `Internal error: Calculated tool name "${namespacedName}" still exceeds ${MAX_TOOL_NAME_LENGTH} characters.`,
    );
  }

  return namespacedName;
}

/**
 * Parse a namespaced tool name back into its components
 * @param namespacedName - The namespaced tool name (e.g., "i_workspace__TOOL_NAME" or "3ddd52b5-7ef9-40af-abc__TOOL_NAME")
 * @returns Object with integrationId and toolName, or null if format doesn't match
 *
 * IMPORTANT: This returns the TRUNCATED integration ID as it appears in the tool name.
 * For long UUIDs, this will be a shortened version (16-24 chars depending on tool name length).
 * Use resolveFullIntegrationId() to recover the full integration ID from available integrations.
 */
function parseToolName(
  namespacedName: string,
): { integrationId: string; toolName: string } | null {
  // Check if the name contains the double underscore separator
  const separatorIndex = namespacedName.lastIndexOf(NAMESPACE_SEPARATOR);

  if (separatorIndex === -1) {
    // Not a namespaced name, return null for backward compatibility
    return null;
  }

  const sanitizedIntegrationId = namespacedName.substring(0, separatorIndex);
  const toolName = namespacedName.substring(
    separatorIndex + NAMESPACE_SEPARATOR.length,
  );

  // Validate that we have both parts
  if (!sanitizedIntegrationId || !toolName) {
    return null;
  }

  // Restore colons in integration ID
  // Integration IDs always follow pattern [ia]:[rest] (e.g., "i:workspace-management" or "a:uuid")
  // Only replace the first underscore after the type prefix (i or a) with a colon
  let integrationId = sanitizedIntegrationId.replace(/^([ia])_/, "$1:");

  // If the normalized integration ID doesn't have a prefix, prepend "i:" (most common case)
  // This handles cases where normalizeMCPId stripped the prefix before storing in toolsets
  if (!integrationId.startsWith("i:") && !integrationId.startsWith("a:")) {
    integrationId = `i:${integrationId}`;
  }

  return {
    integrationId,
    toolName,
  };
}

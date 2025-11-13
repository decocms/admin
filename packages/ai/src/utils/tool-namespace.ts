/**
 * Utility functions for namespacing tool names with integration IDs
 * Format: {integrationIdWithUnderscores}__{toolName}
 *
 * Integration IDs contain colons (e.g., "i:workspace-management"), which are not allowed
 * in tool names per AI SDK validation (pattern: ^[a-zA-Z0-9_-]{1,128}$).
 * So we replace colons with underscores in the integration ID and use double underscore as separator.
 *
 * IMPORTANT: OpenAI has a 64-character limit for tool names. To ensure compatibility,
 * we limit the integration ID prefix to 8 characters maximum, leaving 54 characters
 * for the actual tool name (64 - 8 prefix - 2 separator = 54).
 */

const NAMESPACE_SEPARATOR = "__";
// Maximum length for the integration ID prefix to ensure tool names stay under 64 chars
const MAX_PREFIX_LENGTH = 8;
// OpenAI's maximum tool name length
const MAX_TOOL_NAME_LENGTH = 64;

/**
 * Shortens an integration ID to fit within the maximum prefix length
 * @param integrationId - The integration ID to shorten
 * @returns Shortened integration ID (max 8 characters)
 */
function shortenIntegrationId(integrationId: string): string {
  if (integrationId.length <= MAX_PREFIX_LENGTH) {
    return integrationId;
  }

  // For long IDs (like UUIDs), take the first 8 characters
  // This provides ~2.8 trillion unique combinations (36^8)
  return integrationId.substring(0, MAX_PREFIX_LENGTH);
}

/**
 * Format a tool name with its integration ID as a namespace
 * @param integrationId - The integration ID (e.g., "i:workspace-management" or "a:uuid")
 * @param toolName - The original tool name
 * @returns Namespaced tool name in format {shortIntegrationId}__{toolName}
 * @throws Error if the resulting tool name would exceed 64 characters
 */
export function formatToolName(
  integrationId: string,
  toolName: string,
): string {
  // Replace colons with underscores to comply with tool name validation pattern
  const sanitizedIntegrationId = integrationId.replace(/:/g, "_");

  // Shorten the integration ID to fit within limits
  const shortId = shortenIntegrationId(sanitizedIntegrationId);

  const namespacedName = `${shortId}${NAMESPACE_SEPARATOR}${toolName}`;

  // Validate against OpenAI's 64-character limit
  if (namespacedName.length > MAX_TOOL_NAME_LENGTH) {
    throw new Error(
      `Tool name "${namespacedName}" exceeds maximum length of ${MAX_TOOL_NAME_LENGTH} characters. ` +
        `Consider shortening the tool name "${toolName}" (current length: ${toolName.length}, ` +
        `available: ${MAX_TOOL_NAME_LENGTH - MAX_PREFIX_LENGTH - NAMESPACE_SEPARATOR.length})`,
    );
  }

  return namespacedName;
}

/**
 * Parse a namespaced tool name back into its components
 * @param namespacedName - The namespaced tool name (e.g., "i_workspace__TOOL_NAME" or "3ddd52b5__TOOL_NAME")
 * @returns Object with integrationId and toolName, or null if format doesn't match
 *
 * Note: This returns the SHORT integration ID (up to 8 chars), not the full UUID.
 * This is intentional as we only store the shortened version in tool names.
 */
export function parseToolName(
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

/**
 * Extract just the tool name from a namespaced tool name for display
 * @param namespacedName - The namespaced tool name
 * @returns The tool name without the namespace, or the original string if not namespaced
 */
export function extractToolName(namespacedName: string): string {
  const parsed = parseToolName(namespacedName);
  return parsed?.toolName ?? namespacedName;
}

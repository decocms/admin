/**
 * Utility functions for namespacing tool names with integration IDs
 * Format: {integrationIdWithUnderscores}__{toolName}
 *
 * Integration IDs contain colons (e.g., "i:workspace-management"), which are not allowed
 * in tool names per AI SDK validation (pattern: ^[a-zA-Z0-9_-]{1,128}$).
 * So we replace colons with underscores in the integration ID and use double underscore as separator.
 */

const NAMESPACE_SEPARATOR = "__";

/**
 * Format a tool name with its integration ID as a namespace
 * @param integrationId - The integration ID (e.g., "i:workspace-management")
 * @param toolName - The original tool name
 * @returns Namespaced tool name in format {integrationIdWithUnderscores}__{toolName}
 */
export function formatToolName(
  integrationId: string,
  toolName: string,
): string {
  // Replace colons with underscores to comply with tool name validation pattern
  const sanitizedIntegrationId = integrationId.replace(/:/g, "_");
  return `${sanitizedIntegrationId}${NAMESPACE_SEPARATOR}${toolName}`;
}

/**
 * Parse a namespaced tool name back into its components
 * @param namespacedName - The namespaced tool name (e.g., "i_workspace-management__TOOL_NAME")
 * @returns Object with integrationId and toolName, or null if format doesn't match
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

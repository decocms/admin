/**
 * Utility functions for parsing namespaced tool names
 * Format: {integrationIdWithUnderscores}__{toolName}
 *
 * This is a UI-specific copy of the utility functions from packages/ai/src/utils/tool-namespace.ts
 * to avoid cross-package dependencies.
 *
 * Integration IDs contain colons (e.g., "i:workspace-management"), which are not allowed
 * in tool names per AI SDK validation (pattern: ^[a-zA-Z0-9_-]{1,128}$).
 * So we replace colons with underscores in the integration ID and use double underscore as separator.
 *
 * IMPORTANT: To comply with OpenAI's 64-character limit, integration IDs may be truncated.
 * Use resolveFullIntegrationId() to recover the full ID from available integrations.
 */

const NAMESPACE_SEPARATOR = "__";

/**
 * Parse a namespaced tool name back into its components
 * @param namespacedName - The namespaced tool name (e.g., "i_workspace__TOOL_NAME" or "3ddd52b5-7ef9-40af-abc__TOOL_NAME")
 * @returns Object with integrationId and toolName, or null if format doesn't match
 *
 * Note: This returns the TRUNCATED integration ID as it appears in the tool name.
 * Use resolveFullIntegrationId() to recover the full integration ID.
 */
export function parseToolName(
  namespacedName: string,
): { integrationId: string; toolName: string } | null {
  // Check if the name contains the double underscore separator
  // Use lastIndexOf to handle cases where tool names might contain double underscores
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

/**
 * Resolves a truncated integration ID to its full version using prefix matching
 * @param truncatedId - The truncated integration ID from parseToolName
 * @param availableIntegrationIds - List of full integration IDs to match against
 * @returns The full integration ID if found, or the truncated ID if no match
 *
 * This function handles cases where integration IDs were truncated to fit within
 * OpenAI's 64-character tool name limit. It uses prefix matching to find the
 * corresponding full integration ID.
 */
export function resolveFullIntegrationId(
  truncatedId: string,
  availableIntegrationIds: string[],
): string {
  // First, try exact match (for IDs that weren't truncated)
  if (availableIntegrationIds.includes(truncatedId)) {
    return truncatedId;
  }

  // Sanitize the truncated ID for comparison (replace colons with underscores)
  const sanitizedTruncated = truncatedId.replace(/:/g, "_");

  // Find integration IDs that start with the truncated prefix
  const matches = availableIntegrationIds.filter((fullId) => {
    const sanitizedFull = fullId.replace(/:/g, "_");
    return sanitizedFull.startsWith(sanitizedTruncated);
  });

  if (matches.length === 1) {
    return matches[0];
  }

  if (matches.length > 1) {
    console.warn(
      `[tool-namespace] Multiple integration IDs match truncated prefix "${truncatedId}": ` +
        `[${matches.join(", ")}]. Using first match: ${matches[0]}`,
    );
    return matches[0];
  }

  // No match found - return the truncated ID as-is
  return truncatedId;
}

/**
 * Get status styles based on tool state
 * @param state - The tool state
 * @returns Object with className for the given state
 */
export function getStatusStyles(state: string): { className: string } {
  switch (state) {
    case "input-streaming":
      return {
        className: "text-muted-foreground text-shimmer",
      };
    case "input-available":
      return {
        className: "text-muted-foreground animate-pulse",
      };
    case "output-available":
      return {
        className: "text-muted-foreground",
      };
    case "output-error":
      return {
        className: "text-destructive",
      };
    default:
      return {
        className: "text-muted-foreground",
      };
  }
}

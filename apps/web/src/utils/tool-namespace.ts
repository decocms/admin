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
 */

const NAMESPACE_SEPARATOR = "__";

/**
 * Parse a namespaced tool name back into its components
 * @param namespacedName - The namespaced tool name (e.g., "i_workspace-management__TOOL_NAME")
 * @returns Object with integrationId and toolName, or null if format doesn't match
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
 * Get status styles based on tool state
 * @param state - The tool state
 * @returns Object with className for the given state
 */
export function getStatusStyles(state: string): { className: string } {
  switch (state) {
    case "input-streaming":
      return {
        className:
          "text-muted-foreground bg-gradient-to-r from-foreground via-foreground/50 to-foreground bg-[length:200%_100%] animate-shimmer bg-clip-text text-transparent",
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

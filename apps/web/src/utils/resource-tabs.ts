import type { Integration } from "@deco/sdk";
import { extractResourceUriFromInput } from "../stores/resource-version-history/utils.ts";
import { isResourceUpdateOrCreateTool } from "../stores/resource-version-history/utils.ts";

/**
 * Extract resource URI from tool call input/output
 * Handles both CALL_TOOL wrapper and direct resource tool calls
 */
export function extractResourceUri(
  toolName: string | undefined,
  input: unknown,
  output?: { structuredContent?: { data?: unknown; uri?: string } },
): string | null {
  if (!toolName) return null;

  let resourceUri: string | null = null;

  // Handle CALL_TOOL wrapper
  if (toolName === "CALL_TOOL" && input) {
    const callToolArgs = input as
      | {
          id?: string;
          params?: {
            name?: string;
            arguments?: Record<string, unknown>;
          };
        }
      | undefined;

    const nestedArgs = callToolArgs?.params?.arguments;
    if (nestedArgs && typeof nestedArgs === "object") {
      const maybeUri =
        (nestedArgs as { uri?: unknown; resource?: unknown }).uri ??
        (nestedArgs as { resource?: unknown }).resource;
      resourceUri = typeof maybeUri === "string" ? maybeUri : null;
    }

    // For CREATE operations, check output
    if (!resourceUri && output?.structuredContent?.uri) {
      resourceUri = output.structuredContent.uri;
    }
  } else if (isResourceUpdateOrCreateTool(toolName)) {
    // Handle direct resource tool calls
    resourceUri = extractResourceUriFromInput(input);

    // For CREATE operations, check output if no URI in input
    if (!resourceUri && output?.structuredContent?.uri) {
      resourceUri = output.structuredContent.uri;
    }
  }

  return resourceUri;
}

/**
 * Open a tab for the given resource URI, or activate existing tab
 */
export function openResourceTab(
  resourceUri: string,
  tabs: { id: string; type: "list" | "detail"; resourceUri?: string }[],
  integrations: Integration[],
  addTab: (tab: {
    type: "list" | "detail";
    resourceUri: string;
    title: string;
    icon?: string;
  }) => void,
  setActiveTab: (tabId: string) => void,
  pinTab?: (tab: {
    resourceUri: string;
    title: string;
    type: "list" | "detail";
    icon?: string;
  }) => void,
  shouldPin = false,
): void {
  // Check if tab already exists
  const existingTab = tabs.find(
    (tab) => tab.type === "detail" && tab.resourceUri === resourceUri,
  );

  if (existingTab) {
    // Tab exists, just activate it
    setActiveTab(existingTab.id);
  } else {
    // Extract integration ID from resource URI
    const integrationId = resourceUri.replace(/^rsc:\/\//, "").split("/")[0];
    const integration = integrations.find(
      (i: Integration) => i.id === integrationId,
    );

    const title = resourceUri.split("/").pop() || "Resource";

    // Create new tab (addTab automatically activates it)
    addTab({
      type: "detail",
      resourceUri: resourceUri,
      title,
      icon: integration?.icon,
    });

    // Auto-pin if requested
    if (shouldPin && pinTab) {
      pinTab({
        resourceUri,
        title,
        type: "detail",
        icon: integration?.icon,
      });
    }
  }
}

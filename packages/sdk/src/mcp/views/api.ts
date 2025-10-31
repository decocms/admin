import { z } from "zod";
import { formatIntegrationId, WellKnownMcpGroups } from "../../crud/groups.ts";
import { impl } from "../bindings/binder.ts";
import { WellKnownBindings } from "../bindings/index.ts";
import { VIEW_BINDING_SCHEMA } from "../bindings/views.ts";
import { DeconfigResourceV2 } from "../deconfig-v2/index.ts";
import { createToolGroup, DeconfigClient } from "../index.ts";
import {
  createViewImplementation,
  createViewRenderer,
} from "../views-v2/index.ts";
import { DetailViewRenderInputSchema } from "../views-v2/schemas.ts";
import {
  VIEW_CREATE_PROMPT,
  VIEW_DELETE_PROMPT,
  VIEW_PROMPT,
  VIEW_READ_PROMPT,
  VIEW_SEARCH_PROMPT,
  VIEW_UPDATE_PROMPT,
} from "./prompts.ts";
import { ViewDefinitionSchema } from "./schemas.ts";

/**
 * View Resource V2
 *
 * This module provides a Resources 2.0 implementation for view management
 * using the DeconfigResources 2.0 system with file-based storage.
 *
 * Key Features:
 * - File-based view storage in DECONFIG directories
 * - Resources 2.0 standardized schemas and URI format
 * - Type-safe view definitions with Zod validation
 * - Full CRUD operations for view management
 * - HTML content support with iframe rendering
 * - Custom React-based detail view for rich view editing
 *
 * Usage:
 * - Views are stored as JSON files in /src/views directory
 * - Each view has a unique ID and follows Resources 2.0 URI format
 * - Content is stored as HTML strings that can be rendered in iframes
 * - Custom React view provides rich editing experience with preview
 */

// Create the ViewResourceV2 using DeconfigResources 2.0
export const ViewResourceV2 = DeconfigResourceV2.define({
  directory: "/src/views",
  resourceName: "view",
  group: WellKnownMcpGroups.Views,
  dataSchema: ViewDefinitionSchema,
  enhancements: {
    DECO_RESOURCE_VIEW_SEARCH: {
      description: VIEW_SEARCH_PROMPT,
    },
    DECO_RESOURCE_VIEW_READ: {
      description: VIEW_READ_PROMPT,
    },
    DECO_RESOURCE_VIEW_CREATE: {
      description: VIEW_CREATE_PROMPT,
    },
    DECO_RESOURCE_VIEW_UPDATE: {
      description: VIEW_UPDATE_PROMPT,
    },
    DECO_RESOURCE_VIEW_DELETE: {
      description: VIEW_DELETE_PROMPT,
    },
  },
});

// Export types for TypeScript usage
export type ViewDataV2 = z.infer<typeof ViewDefinitionSchema>;

// Helper function to create a view resource implementation
export function createViewResourceV2Implementation(
  deconfig: DeconfigClient,
  integrationId: string,
) {
  // No transformation needed - frontend will generate HTML from code
  return ViewResourceV2.create(deconfig, integrationId);
}

const createViewTool = createToolGroup("Views", {
  name: "Views Management",
  description: "Manage your custom views",
  icon: "https://assets.decocache.com/mcp/81d602bb-45e2-4361-b52a-23379520a34d/sandbox.png",
});

/**
 * Creates Views 2.0 implementation for view views with custom React renderer
 *
 * This function creates a complete Views 2.0 implementation that includes:
 * - Custom React-based detail view for rich view editing with HTML preview
 * - Resources 2.0 CRUD operations for views
 * - Resource-centric URL patterns for better organization
 *
 * The detail view uses a react:// URL scheme to render a custom React component
 * in the frontend, providing a rich HTML editing experience with live preview.
 *
 * @returns Views 2.0 implementation for view views
 */
export function createViewViewsV2() {
  const integrationId = formatIntegrationId(WellKnownMcpGroups.Views);

  const viewDetailRenderer = createViewRenderer({
    name: "view_detail",
    title: "View Detail",
    description: "View and edit view HTML content with live preview",
    icon: "https://assets.decocache.com/mcp/81d602bb-45e2-4361-b52a-23379520a34d/sandbox.png",
    inputSchema: DetailViewRenderInputSchema,
    tools: [
      "DECO_RESOURCE_VIEW_READ",
      "DECO_RESOURCE_VIEW_UPDATE",
      "DECO_RESOURCE_VIEW_DELETE",
    ],
    prompt: VIEW_PROMPT,
    handler: (input, _c) => {
      // Return a custom react:// URL that the frontend will handle
      // The frontend will render a custom React component for this view
      const url = `react://view_detail?integration=${integrationId}&resource=${encodeURIComponent(input.resource)}`;
      return Promise.resolve({ url });
    },
  });

  // Create Views 2.0 implementation
  const viewsV2Implementation = createViewImplementation({
    renderers: [viewDetailRenderer],
  });

  return viewsV2Implementation;
}

/**
 * Creates legacy view views implementation for backward compatibility
 *
 * This provides the legacy VIEW_BINDING_SCHEMA implementation that was used
 * before the Views 2.0 system. It creates view list and detail views
 * using the internal://resource URL pattern.
 *
 * @returns Legacy view views implementation using VIEW_BINDING_SCHEMA
 */
export const viewViews = impl(
  VIEW_BINDING_SCHEMA,
  [
    // DECO_CHAT_VIEWS_LIST
    {
      description: "List views exposed by this MCP",
      handler: (_, c) => {
        c.resourceAccess.grant();

        const org = c.locator?.org;
        const project = c.locator?.project;

        if (!org || !project) {
          return { views: [] };
        }

        return {
          views: [
            // View List View
            {
              name: "VIEWS_LIST",
              title: "Views",
              description: "Manage and organize your custom views",
              icon: "visibility",
              url: `internal://resource/list?name=view`,
              tools: WellKnownBindings.Resources.map(
                (resource) => resource.name,
              ),
              rules: [
                "You are a specialist for crud operations on resources. Use the resource tools to read, search, create, update, or delete items; do not fabricate data.",
              ],
            },
            // View Detail View (for individual view management)
            {
              name: "VIEW_DETAIL",
              title: "View Detail",
              description:
                "View and edit individual view details with HTML preview",
              icon: "visibility",
              url: `internal://resource/detail?name=view`,
              mimeTypePattern: "application/json",
              resourceName: "view",
              tools: [
                "DECO_RESOURCE_VIEW_READ",
                "DECO_RESOURCE_VIEW_UPDATE",
                "DECO_RESOURCE_VIEW_DELETE",
              ],
              rules: [
                "You are a specialized UI development assistant helping users create beautiful, theme-consistent views.",
                "ALWAYS log: props on mount, tool calls (before/after/errors), state changes with [ViewName] prefix",
                "ALWAYS use theme tokens (CSS custom properties) instead of hardcoded colors: --background, --foreground, --card, --primary, --secondary, --muted, --accent, --destructive, --success, --warning, --border, --input, --ring, --radius",
                'Use tokens in Tailwind: className="bg-[var(--primary)] text-[var(--primary-foreground)] rounded-[var(--radius)]"',
                "Views run in browser without build step - use Basecoat UI (https://basecoatui.com/) for HTML-only components instead of React shadcn",
                "Semantic token usage: --destructive for delete, --success for confirmations, --warning for caution, --muted for disabled",
                "Error handling: use try/catch when calling tools and log errors",
                "Views automatically adapt when workspace theme changes - never hardcode colors",
              ],
            },
          ],
        };
      },
    },
  ],
  createViewTool,
);

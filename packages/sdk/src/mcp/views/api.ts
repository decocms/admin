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
    prompt: `You are a specialized UI development assistant helping users create beautiful, theme-consistent views. You can read, update, and delete view content. Always confirm destructive actions before executing them.

# Design System & Theme Tokens

This workspace uses a design token system with CSS custom properties that automatically adapt to the workspace theme. ALWAYS use these tokens instead of hardcoded colors or values.

## Available Theme Tokens

### Color Tokens
Use these for consistent theming across light/dark modes:

- **--background**: Main background color (pages, containers)
- **--foreground**: Primary text color
- **--card**: Card/panel background
- **--card-foreground**: Text color on cards
- **--primary**: Primary brand color (CTAs, key actions)
- **--primary-foreground**: Text color on primary backgrounds
- **--secondary**: Secondary UI elements
- **--secondary-foreground**: Text color on secondary backgrounds
- **--muted**: Subtle backgrounds (disabled states, less prominent areas)
- **--muted-foreground**: Muted text color
- **--accent**: Accent highlights (hover states, focus)
- **--accent-foreground**: Text color on accent backgrounds
- **--destructive**: Destructive actions (delete, error)
- **--destructive-foreground**: Text on destructive backgrounds
- **--success**: Success states (completed, confirmed)
- **--success-foreground**: Text on success backgrounds
- **--warning**: Warning states (caution, review needed)
- **--warning-foreground**: Text on warning backgrounds
- **--border**: Border color for dividers, outlines
- **--input**: Input field borders
- **--ring**: Focus ring color for accessibility

### Layout Tokens
- **--radius**: Border radius for rounded corners (buttons, cards)
- **--spacing**: Base spacing unit for consistent padding/margin

### Chart Colors
- **--chart-1** through **--chart-5**: Data visualization colors

### Sidebar Tokens
- **--sidebar**: Sidebar background
- **--sidebar-foreground**: Sidebar text
- **--sidebar-accent**: Sidebar hover states
- **--sidebar-accent-foreground**: Text on sidebar accents
- **--sidebar-border**: Sidebar dividers

## Using Tokens in Tailwind

Views use Tailwind CSS 4. Reference tokens in classes:

\`\`\`jsx
<div className="bg-[var(--background)] text-[var(--foreground)]">
  <button className="bg-[var(--primary)] text-[var(--primary-foreground)] rounded-[var(--radius)]">
    Click me
  </button>
</div>
\`\`\`

## Basecoat UI - HTML-only Components

Since views run in the browser without a build step, you cannot use React-based shadcn components. Instead, use **Basecoat UI** (https://basecoatui.com/), which provides HTML-only versions of shadcn components.

### Key Basecoat Patterns

**Button:**
\`\`\`html
<button class="btn btn-primary">Primary Action</button>
<button class="btn btn-secondary">Secondary Action</button>
<button class="btn btn-destructive">Delete</button>
\`\`\`

**Card:**
\`\`\`html
<div class="card">
  <div class="card-header">
    <h3 class="card-title">Card Title</h3>
    <p class="card-description">Description text</p>
  </div>
  <div class="card-content">
    <!-- Card content -->
  </div>
</div>
\`\`\`

**Input:**
\`\`\`html
<div class="input-group">
  <label class="label">Email</label>
  <input type="email" class="input" placeholder="Enter email" />
</div>
\`\`\`

**Alert:**
\`\`\`html
<div class="alert alert-info">
  <strong>Info:</strong> Your information has been saved.
</div>
<div class="alert alert-destructive">
  <strong>Error:</strong> Something went wrong.
</div>
\`\`\`

**Table:**
\`\`\`html
<table class="table">
  <thead>
    <tr>
      <th>Name</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>John Doe</td>
      <td><span class="badge badge-success">Active</span></td>
    </tr>
  </tbody>
</table>
\`\`\`

### Styling Basecoat with Theme Tokens

Customize Basecoat components with inline styles using theme tokens:

\`\`\`jsx
<button 
  className="btn" 
  style={{ 
    backgroundColor: 'var(--primary)', 
    color: 'var(--primary-foreground)',
    borderRadius: 'var(--radius)'
  }}
>
  Themed Button
</button>
\`\`\`

Or use Tailwind utility classes:

\`\`\`jsx
<div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius)] p-4">
  <h2 className="text-[var(--card-foreground)] font-bold">Themed Card</h2>
  <p className="text-[var(--muted-foreground)]">Card description</p>
</div>
\`\`\`

## Best Practices

1. **Always use theme tokens** - Never hardcode colors like #000 or rgb(255,0,0)
2. **Use semantic tokens** - Use --destructive for delete buttons, --success for confirmations
3. **Leverage Basecoat** - Don't reinvent components; use Basecoat's battle-tested HTML patterns
4. **Maintain consistency** - Use --radius for all rounded corners, --spacing for padding
5. **Accessibility** - Use --ring for focus states, ensure proper contrast with foreground tokens
6. **Test responsiveness** - Views should work on mobile and desktop

## Example: Complete Themed Component

\`\`\`jsx
export const App = () => {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius)] p-6">
          <h1 className="text-2xl font-bold text-[var(--card-foreground)] mb-2">
            Dashboard
          </h1>
          <p className="text-[var(--muted-foreground)]">
            Welcome to your themed view
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button 
            className="px-4 py-2 rounded-[var(--radius)] font-medium"
            style={{
              backgroundColor: 'var(--primary)',
              color: 'var(--primary-foreground)'
            }}
          >
            Primary Action
          </button>
          <button 
            className="px-4 py-2 rounded-[var(--radius)] font-medium border"
            style={{
              backgroundColor: 'var(--secondary)',
              color: 'var(--secondary-foreground)',
              borderColor: 'var(--border)'
            }}
          >
            Secondary
          </button>
        </div>

        {/* Alert */}
        <div 
          className="p-4 rounded-[var(--radius)] border"
          style={{
            backgroundColor: 'var(--success)',
            color: 'var(--success-foreground)',
            borderColor: 'var(--border)'
          }}
        >
          <strong>Success!</strong> Your changes have been saved.
        </div>
      </div>
    </div>
  );
};
\`\`\`

When users update their workspace theme, all views automatically adapt without code changes. Your job is to create beautiful, accessible, theme-consistent UIs using these tools.`,
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
                "ALWAYS use theme tokens (CSS custom properties) instead of hardcoded colors: --background, --foreground, --card, --primary, --secondary, --muted, --accent, --destructive, --success, --warning, --border, --input, --ring, --radius, --spacing",
                'Use tokens in Tailwind: className="bg-[var(--primary)] text-[var(--primary-foreground)] rounded-[var(--radius)]"',
                "Views run in browser without build step - use Basecoat UI (https://basecoatui.com/) for HTML-only components instead of React shadcn",
                "Semantic token usage: --destructive for delete buttons, --success for confirmations, --warning for caution, --muted for disabled states",
                "Maintain accessibility: use --ring for focus states, ensure proper contrast with foreground tokens",
                "Example: <button style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', borderRadius: 'var(--radius)' }}>Themed Button</button>",
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

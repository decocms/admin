# View System Architecture (Views 2.0)

## Overview

Views in deco CMS follow the **Views 2.0** architecture, which is built on top of the **Resources 2.0** system. This provides a standardized way to define custom UI views for different resource types like workflows, documents, tools, and custom views.

## Core Concepts

### 1. **View Renderers**
A view renderer defines how a specific view type should be rendered. Each renderer specifies:
- **name**: Unique identifier for the renderer (e.g., `workflow_detail`)
- **title**: Human-readable title
- **description**: Brief description of what the view does
- **icon**: URL to an icon image
- **inputSchema**: Zod schema defining expected input (usually contains `resource` URI)
- **tools**: Array of tool names that the AI can use in this view context
- **prompt**: LLM instructions for how to behave in this view
- **handler**: Function that returns a URL to render the view

### 2. **View Implementation**
View implementations combine multiple renderers into a cohesive set of view tools. The `createViewImplementation()` helper automatically generates MCP tools from renderers.

### 3. **URL Schemes**
Views use two main URL schemes:
- **`react://`**: Custom React components rendered by the frontend (e.g., `react://document_detail?integration=...&resource=...`)
- **`internal://resources/`**: Internal resource views with standardized patterns

## Architecture Pattern

All view implementations follow the same pattern:

```typescript
export function create[Entity]ViewsV2() {
  const integrationId = formatIntegrationId(WellKnownMcpGroups.[Entity]);

  const [entity]DetailRenderer = createViewRenderer({
    name: "[entity]_detail",
    title: "[Entity] Detail",
    description: "View and manage individual [entity] details",
    icon: "https://example.com/icons/[entity]-detail.svg",
    inputSchema: DetailViewRenderInputSchema,
    tools: [
      "DECO_RESOURCE_[ENTITY]_READ",
      "DECO_RESOURCE_[ENTITY]_UPDATE",
      "DECO_RESOURCE_[ENTITY]_DELETE",
      // ... entity-specific tools
    ],
    prompt: "LLM instructions for this view...",
    handler: (input, _c) => {
      const url = createDetailViewUrl("[entity]", integrationId, input.resource);
      return Promise.resolve({ url });
    },
  });

  const viewsV2Implementation = createViewImplementation({
    renderers: [[entity]DetailRenderer],
  });

  return viewsV2Implementation;
}
```

## Implemented View Types

### 1. **Workflow Views** (`packages/sdk/src/mcp/workflows/api.ts`)

**Location**: `createWorkflowViewsV2()`

**Renderers**:
- `workflow_detail`: Main workflow detail view
  - **Tools**: `DECO_RESOURCE_WORKFLOW_UPDATE`, `DECO_WORKFLOW_START`, `DECO_WORKFLOW_RUN_STEP`, `DECO_WORKFLOW_CREATE_STEP`, `DECO_WORKFLOW_EDIT_STEP`, `DECO_RESOURCE_WORKFLOW_RUN_READ`
  - **URL**: `react://workflow_detail?uri=...&integrationId=...&view=detail`
  
- `workflow_run`: Workflow run detail view for inspecting execution
  - **Tools**: `DECO_RESOURCE_WORKFLOW_RUN_READ`
  - **URL**: `react://workflow_run_detail?uri=...&integrationId=...&view=detail`
  - **Purpose**: Inspect run status, step results, logs, and timing

**Example**:
```typescript
export function createWorkflowViewsV2() {
  const integrationId = formatIntegrationId(WellKnownMcpGroups.Workflows);

  const workflowDetailRenderer = createViewRenderer({
    name: "workflow_detail",
    title: "Workflow Detail",
    description: "View and manage individual workflow details",
    icon: "https://example.com/icons/workflow-detail.svg",
    inputSchema: DetailViewRenderInputSchema,
    tools: [
      "DECO_RESOURCE_WORKFLOW_UPDATE",
      "DECO_WORKFLOW_START",
      "DECO_WORKFLOW_RUN_STEP",
      "DECO_WORKFLOW_CREATE_STEP",
      "DECO_WORKFLOW_EDIT_STEP",
      "DECO_RESOURCE_WORKFLOW_RUN_READ",
    ],
    prompt: WORKFLOW_DETAIL_PROMPT,
    handler: (input, _c) => {
      const url = createDetailViewUrl("workflow", integrationId, input.resource);
      return Promise.resolve({ url });
    },
  });

  const workflowRunDetailRenderer = createViewRenderer({
    name: "workflow_run",
    title: "Workflow Run Detail",
    description: "Inspect a specific workflow run details and status",
    icon: "https://example.com/icons/workflow-run-detail.svg",
    inputSchema: DetailViewRenderInputSchema,
    tools: ["DECO_RESOURCE_WORKFLOW_RUN_READ"],
    prompt: "You are viewing a workflow run. Use DECO_RESOURCE_WORKFLOW_RUN_READ to show current status...",
    handler: (input, _c) => {
      const url = createDetailViewUrl("workflow_run", integrationId, input.resource);
      return Promise.resolve({ url });
    },
  });

  return createViewImplementation({
    renderers: [workflowDetailRenderer, workflowRunDetailRenderer],
  });
}
```

---

### 2. **Document Views** (`packages/sdk/src/mcp/documents/api.ts`)

**Location**: `createDocumentViewsV2()`

**Renderers**:
- `document_detail`: Rich markdown editor view
  - **Tools**: `DECO_RESOURCE_DOCUMENT_READ`, `DECO_RESOURCE_DOCUMENT_UPDATE`, `DECO_RESOURCE_DOCUMENT_DELETE`
  - **URL**: `react://document_detail?integration=...&resource=...`
  - **Prompt**: Emphasizes reading before editing, direct updates to the document

**Example**:
```typescript
export function createDocumentViewsV2() {
  const integrationId = formatIntegrationId(WellKnownMcpGroups.Documents);

  const documentDetailRenderer = createViewRenderer({
    name: "document_detail",
    title: "Document Detail",
    description: "View and edit document content with a rich markdown editor",
    icon: "https://example.com/icons/document-detail.svg",
    inputSchema: DetailViewRenderInputSchema,
    tools: [
      "DECO_RESOURCE_DOCUMENT_READ",
      "DECO_RESOURCE_DOCUMENT_UPDATE",
      "DECO_RESOURCE_DOCUMENT_DELETE",
    ],
    prompt: "You are a document editing specialist... ALWAYS use @DECO_RESOURCE_DOCUMENT_READ first...",
    handler: (input, _c) => {
      const url = `react://document_detail?integration=${integrationId}&resource=${encodeURIComponent(input.resource)}`;
      return Promise.resolve({ url });
    },
  });

  return createViewImplementation({
    renderers: [documentDetailRenderer],
  });
}
```

---

### 3. **Tool Views** (`packages/sdk/src/mcp/tools/api.ts`)

**Location**: `createToolViewsV2()`

**Renderers**:
- `tool_detail`: Tool management and testing view
  - **Tools**: `DECO_RESOURCE_TOOL_READ`, `DECO_RESOURCE_TOOL_UPDATE`, `DECO_RESOURCE_TOOL_DELETE`, `DECO_TOOL_CALL_TOOL`
  - **URL**: `react://tool_detail?uri=...&integrationId=...&view=detail`
  - **Purpose**: Read, update, test, and manage tool definitions

**Example**:
```typescript
export function createToolViewsV2() {
  const integrationId = formatIntegrationId(WellKnownMcpGroups.Tools);

  const toolDetailRenderer = createViewRenderer({
    name: "tool_detail",
    title: "Tool Detail",
    description: "View and manage individual tool details",
    icon: "https://example.com/icons/tool-detail.svg",
    inputSchema: DetailViewRenderInputSchema,
    tools: [
      "DECO_RESOURCE_TOOL_READ",
      "DECO_RESOURCE_TOOL_UPDATE",
      "DECO_RESOURCE_TOOL_DELETE",
      "DECO_TOOL_CALL_TOOL",
    ],
    prompt: "You are a tool management specialist... Help the user understand tool definitions and test tool execution.",
    handler: (input, _c) => {
      const url = createDetailViewUrl("tool", integrationId, input.resource);
      return Promise.resolve({ url });
    },
  });

  return createViewImplementation({
    renderers: [toolDetailRenderer],
  });
}
```

---

### 4. **View Views** (`packages/sdk/src/mcp/views/api.ts`)

**Location**: `createViewViewsV2()`

**Renderers**:
- `view_detail`: HTML/React code editor with live preview
  - **Tools**: `DECO_RESOURCE_VIEW_READ`, `DECO_RESOURCE_VIEW_UPDATE`, `DECO_RESOURCE_VIEW_DELETE`
  - **URL**: `react://view_detail?integration=...&resource=...`
  - **Purpose**: Rich HTML editing experience with iframe preview

**Example**:
```typescript
export function createViewViewsV2() {
  const integrationId = formatIntegrationId(WellKnownMcpGroups.Views);

  const viewDetailRenderer = createViewRenderer({
    name: "view_detail",
    title: "View Detail",
    description: "View and edit view HTML content with live preview",
    icon: "https://assets.decocache.com/mcp/...",
    inputSchema: DetailViewRenderInputSchema,
    tools: [
      "DECO_RESOURCE_VIEW_READ",
      "DECO_RESOURCE_VIEW_UPDATE",
      "DECO_RESOURCE_VIEW_DELETE",
    ],
    prompt: VIEW_PROMPT,
    handler: (input, _c) => {
      const url = `react://view_detail?integration=${integrationId}&resource=${encodeURIComponent(input.resource)}`;
      return Promise.resolve({ url });
    },
  });

  return createViewImplementation({
    renderers: [viewDetailRenderer],
  });
}
```

---

### 5. **Agent Views**

**Status**: ❌ Not yet implemented

Agents currently don't have a dedicated `createAgentViewsV2()` implementation. Agent views may be handled differently or are pending implementation.

---

## Helper Functions

### `createViewRenderer()`
Creates a view renderer configuration object.

**Location**: `packages/sdk/src/mcp/views-v2/helpers.ts`

```typescript
export function createViewRenderer<TInputSchema extends z.ZodTypeAny>(
  options: ViewRendererOptions<TInputSchema>
): ViewRenderer<TInputSchema>
```

### `createViewImplementation()`
Converts an array of view renderers into MCP tool implementations.

**Location**: `packages/sdk/src/mcp/views-v2/helpers.ts`

```typescript
export function createViewImplementation(options: ViewImplementationOptions)
```

This function:
1. Maps each renderer to a tool with name `DECO_VIEW_RENDER_{NAME}`
2. Creates input/output schemas using Zod
3. Wraps the handler to grant resource access and return URL + prompt + tools

### `createDetailViewUrl()`
Helper to generate standardized detail view URLs.

**Location**: `packages/sdk/src/mcp/views-v2/helpers.ts`

```typescript
export function createDetailViewUrl(
  resourceType: string,
  integrationId: string,
  resourceUri: string,
  params: Record<string, string> = {},
): string
```

Returns: `react://{resourceType}_detail?uri=...&integrationId=...&view=detail`

---

## Input Schemas

### `DetailViewRenderInputSchema`
Standard input schema for detail views:

```typescript
export const DetailViewRenderInputSchema = z.object({
  resource: z
    .string()
    .regex(
      /^rsc:\/\/[^/]+\/[^/]+\/.+$/,
      "Invalid resource URI format. Expected format: rsc://integration/resource/resource-id"
    )
    .describe("URI of the resource to render in the view"),
});
```

### `ViewRenderOutputSchema`
Standard output for all view renderers:

```typescript
export const ViewRenderOutputSchema = z.object({
  url: z.string().describe("URL to render the view"),
  prompt: z.string().optional().describe("Optional LLM prompt for this view context"),
  tools: z.array(z.string()).optional().describe("Optional array of tool names for this view context"),
});
```

---

## Resource Integration

Views are tightly integrated with the Resources 2.0 system:

1. **Resource CRUD Operations**: Each entity has standard CRUD tools:
   - `DECO_RESOURCE_[ENTITY]_SEARCH`
   - `DECO_RESOURCE_[ENTITY]_READ`
   - `DECO_RESOURCE_[ENTITY]_CREATE`
   - `DECO_RESOURCE_[ENTITY]_UPDATE`
   - `DECO_RESOURCE_[ENTITY]_DELETE`

2. **Resource URIs**: Follow the format `rsc://integration/resource/resource-id`

3. **View Rendering**: View renderers are exposed as tools like `DECO_VIEW_RENDER_WORKFLOW_DETAIL`

---

## Registration in API

Views are registered in the main API handler (`apps/api/src/api.ts`):

```typescript
// Create resource implementations
const viewResourceV2 = createViewResourceV2Implementation(deconfig, "i:views");
const workflowResourceV2 = createWorkflowResourceV2Implementation(deconfig, "i:workflows");
const documentResourceV2 = createDocumentResourceV2Implementation(deconfig, "i:documents");
const toolResourceV2 = createToolResourceV2Implementation(deconfig, "i:tools");

// Create view implementations
const viewViewsV2 = createViewViewsV2();
const workflowViewsV2 = createWorkflowViewsV2();
const documentViewsV2 = createDocumentViewsV2();
const toolViewsV2 = createToolViewsV2();

// Register tools
mcp.addTools([
  ...viewResourceV2,
  ...viewViewsV2,
  ...workflowResourceV2,
  ...workflowViewsV2,
  ...documentResourceV2,
  ...documentViewsV2,
  ...toolResourceV2,
  ...toolViewsV2,
]);
```

---

## Creating New Views

To add a new entity with views:

1. **Define the resource** using `DeconfigResourceV2.define()`
2. **Create the views implementation**:

```typescript
export function createMyEntityViewsV2() {
  const integrationId = formatIntegrationId(WellKnownMcpGroups.MyEntity);

  const myEntityDetailRenderer = createViewRenderer({
    name: "my_entity_detail",
    title: "My Entity Detail",
    description: "View and manage my entity",
    icon: "https://example.com/icon.svg",
    inputSchema: DetailViewRenderInputSchema,
    tools: [
      "DECO_RESOURCE_MY_ENTITY_READ",
      "DECO_RESOURCE_MY_ENTITY_UPDATE",
      "DECO_RESOURCE_MY_ENTITY_DELETE",
    ],
    prompt: "You are helping manage my entity...",
    handler: (input, _c) => {
      const url = createDetailViewUrl("my_entity", integrationId, input.resource);
      return Promise.resolve({ url });
    },
  });

  return createViewImplementation({
    renderers: [myEntityDetailRenderer],
  });
}
```

3. **Register in API** as shown above
4. **Implement the frontend React component** at `react://my_entity_detail`

---

## Key Files

- **View Helpers**: `packages/sdk/src/mcp/views-v2/helpers.ts`
- **View Schemas**: `packages/sdk/src/mcp/views-v2/schemas.ts`
- **Workflow Views**: `packages/sdk/src/mcp/workflows/api.ts`
- **Document Views**: `packages/sdk/src/mcp/documents/api.ts`
- **Tool Views**: `packages/sdk/src/mcp/tools/api.ts`
- **View Views**: `packages/sdk/src/mcp/views/api.ts`
- **API Registration**: `apps/api/src/api.ts`

---

## Summary

The Views 2.0 system provides a consistent, type-safe way to define custom UI views for different resource types. Each view implementation:

✅ Uses `createViewRenderer()` to define renderers  
✅ Uses `createViewImplementation()` to convert to MCP tools  
✅ Returns URLs (typically `react://` or `internal://resources/`)  
✅ Specifies available tools for the AI assistant  
✅ Includes LLM prompts for contextual behavior  
✅ Integrates with Resources 2.0 CRUD operations  

This architecture enables rapid development of new admin views with full AI assistant integration.


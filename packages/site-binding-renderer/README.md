# Site Binding Renderer

A lightweight, runtime-agnostic renderer for the **SITE** binding protocol. This library enables any site content to be addressable and renderable through MCP (Model Context Protocol), decoupling the frontend from specific backends.

## Overview

In the MCP Mesh ecosystem, a "site" is fully browsable and renderable through MCP tools. This library provides:

1.  **SITE Binding Definition**: A standard interface for site content, pages, and views.
2.  **Core Renderer**: A small engine that fetches pages via MCP and renders them using registered views.
3.  **Adapters**: Examples for Client-side (SPA) and Server-side (SSR) rendering.

## Installation

```bash
npm install site-binding-renderer
```

## Usage

### 1. Define Views

Create view functions that accept `ViewProps` and return your desired output (HTML string, DOM element, React node, etc.).

```typescript
import { ViewProps } from 'site-binding-renderer';

const HeaderView = (props: ViewProps) => {
  return `<h1>${props.data.title}</h1>`;
};
```

### 2. Register Views

Use the `ViewRegistry` to map content types or view IDs to your implementations.

```typescript
import { ViewRegistry } from 'site-binding-renderer';

const registry = new ViewRegistry<string>();
registry.register('header', HeaderView);
```

### 3. Connect to MCP

Create a client to communicate with your MCP endpoint.

```typescript
import { createSiteClient } from 'site-binding-renderer';

const client = createSiteClient({
  baseUrl: 'http://localhost:3000/mcp',
  token: 'optional-auth-token'
});
```

### 4. Render a Path

Fetch and render a page for a specific path.

```typescript
import { renderPath } from 'site-binding-renderer';

const html = await renderPath({
  client,
  registry,
  path: '/about',
  renderPage: (page, blocks) => {
    return `<html><body>${blocks.join('')}</body></html>`;
  }
});
```

## Examples

### Client-Only (SPA)

See `examples/client-only/`.
- Uses a simple `index.html` and `app.ts`.
- Fetches content from MCP directly in the browser.
- Handles client-side navigation.

### Hono SSR

See `examples/hono-ssr/`.
- Uses a Hono server to render pages on the server.
- Returns fully formed HTML to the client.
- Ideal for SEO and performance.

## SITE Binding Protocol

The SITE binding defines the following tools:

- `GET_PAGE_CONTENT_FOR_PATH({ path })`: Resolves a URL path to a Page configuration.
- `LIST_CONTENT_TYPES()`: Lists available content schemas.
- `GET_CONTENT({ type, id })`: Fetches specific content.
- `SEARCH_CONTENT({ type, query })`: Searches content.

A **Page** consists of **Content Blocks**. Each block references a **Content Type** and has **Input** (either static config or dynamic tool arguments).

## CDN Caching (Electric-style)

This library supports deterministic, cacheable tool calls to enable efficient CDN caching.

### Key Principles

1.  **Deterministic URLs**: Read-only tool calls are converted to canonical GET URLs:
    `/mcp/TOOL_NAME?param1=value1&param2=value2&v=version`
2.  **Input Normalization**: Input objects are normalized (keys sorted) to ensure stable URLs.
3.  **Cache Metadata**: The SITE binding defines cache policies (`public`, `ttlSeconds`, `vary`) for each tool.

### How it works

When `createSiteClient` is used, it automatically checks if a tool is cacheable. If so, it performs a `GET` request to the canonical URL instead of a `POST`.

**Example:**

Calling `GET_PAGE_CONTENT_FOR_PATH({ path: '/about' })` results in:

```http
GET /mcp/GET_PAGE_CONTENT_FOR_PATH?path=%2Fabout
```

The MCP server should respond with appropriate `Cache-Control` headers (e.g., `public, s-maxage=300`).

### Versioning

To bust the cache for specific content, pass a `v` parameter in the tool arguments. This is automatically extracted and appended as a query parameter.

```typescript
client.callTool('GET_CONTENT', { type: 'post', id: '123', v: 'hash-of-content' });
// -> GET /mcp/GET_CONTENT?id=123&type=post&v=hash-of-content
```

## Security

- The renderer passes the auth token to the MCP endpoint. Ensure you use HTTPS in production.
- Be careful when rendering HTML from untrusted sources. The examples use simple string concatenation, but in production, you should sanitize inputs or use a secure templating engine.

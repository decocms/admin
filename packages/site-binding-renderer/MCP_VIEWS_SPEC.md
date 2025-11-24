# MCP Server: Implement LIST_VIEWS Tool

## Overview

Implement the `LIST_VIEWS` tool in your MCP server to enable dynamic view loading. This allows views authored in DecoCMS to be used by the `site-binding-renderer`.

## Tool Specification

**Tool Name:** `LIST_VIEWS`

**Input Schema:**
```json
{}
```
(No input parameters required)

**Output Schema:**
```json
{
  "views": [
    {
      "key": "string",        // Unique identifier for the view
      "contentType": "string", // Optional: content type this view handles
      "code": "string"        // JavaScript code for the view function
    }
  ]
}
```

## Implementation Guide

### 1. Return Format

The tool should return an array of view definitions:

```json
{
  "views": [
    {
      "key": "blog-post-card",
      "contentType": "post",
      "code": "return `<article class=\"post-card\"><h3>${data.title}</h3><p>${data.body}</p></article>`;"
    },
    {
      "key": "header-nav",
      "contentType": "header",
      "code": "const nav = (data.links || []).map(l => `<a href=\"${l.href}\">${l.label}</a>`).join(' | '); return `<header><h1>${data.title || 'Site'}</h1><nav>${nav}</nav></header>`;"
    },
    {
      "key": "html-block",
      "contentType": "html",
      "code": "return data.html || '';"
    },
    {
      "key": "footer-simple",
      "contentType": "footer",
      "code": "return `<footer><p>${data.copyright || '© 2024'}</p></footer>`;"
    }
  ]
}
```

### 2. View Code Format

Each view's `code` should be a JavaScript expression that:
- Has access to `data` (the block's input data)
- Has access to `block` (the ContentBlock object)
- Returns a string (HTML for SSR) or React element (for client-side)

**Example for SSR (string return):**
```javascript
{
  "key": "post-list",
  "contentType": "post-list",
  "code": "const items = (data.posts || []).map(p => `<article><h3>${p.title}</h3><p>${p.body}</p></article>`).join(''); return `<div class=\"posts\">${items}</div>`;"
}
```

**Example for React (JSX):**
```javascript
{
  "key": "post-list-react",
  "contentType": "post-list",
  "code": "return React.createElement('div', { className: 'posts' }, (data.posts || []).map((p, i) => React.createElement('article', { key: i }, React.createElement('h3', null, p.title), React.createElement('p', null, p.body))));"
}
```

### 3. Where to Store Views

You can store views in your DecoCMS project:

**Option A: Database**
- Store views in a `views` table
- Each view has: `key`, `contentType`, `code`, `description`
- Query and return them in `LIST_VIEWS`

**Option B: File System**
- Store views as `.js` files in a `views/` directory
- Read and return them in `LIST_VIEWS`

**Option C: Hardcoded**
- Return a static array of view definitions
- Good for initial testing

### 4. Example Implementation

```typescript
// In your MCP server
export const LIST_VIEWS = {
  name: "LIST_VIEWS",
  description: "List all available view implementations",
  inputSchema: z.object({}),
  outputSchema: z.object({
    views: z.array(z.object({
      key: z.string(),
      contentType: z.string().optional(),
      code: z.string()
    }))
  }),
  
  handler: async () => {
    // Example: Return hardcoded views
    return {
      views: [
        {
          key: "blog-post-card",
          contentType: "post",
          code: `
            const { title, body, author, publishedAt } = data;
            return \`
              <article class="post-card">
                <h3>\${title}</h3>
                <p class="meta">By \${author} on \${publishedAt}</p>
                <p>\${body}</p>
              </article>
            \`;
          `.trim()
        },
        {
          key: "header-nav",
          contentType: "header",
          code: `
            const { title = 'My Site', links = [] } = data;
            const nav = links.map(l => \`<a href="\${l.href}">\${l.label}</a>\`).join(' | ');
            return \`<header><h1>\${title}</h1><nav>\${nav}</nav></header>\`;
          `.trim()
        },
        {
          key: "html-block",
          contentType: "html",
          code: "return data.html || '';"
        },
        {
          key: "footer-simple",
          contentType: "footer",
          code: `
            const { copyright = '© 2024', links = [] } = data;
            const footerLinks = links.map(l => \`<a href="\${l.href}">\${l.label}</a>\`).join(' | ');
            return \`<footer><p>\${copyright}</p><nav>\${footerLinks}</nav></footer>\`;
          `.trim()
        }
      ]
    };
  }
};
```

### 5. Testing

After implementing, test with:

```bash
cd packages/site-binding-renderer
export MCP_SERVER_TOKEN=$(grep DECOCMS_GUI_COOKIE ../../.cookie.mcp | cut -d'=' -f2-)
bun run serve:server
```

The server will now load views from your MCP server instead of using hardcoded views!

### 6. Advanced: View Versioning

For production, consider adding versioning:

```json
{
  "key": "blog-post-card",
  "contentType": "post",
  "version": "1.0.0",
  "code": "...",
  "updatedAt": "2024-01-23T10:00:00Z"
}
```

This enables:
- Cache invalidation when views change
- Rollback to previous versions
- A/B testing different view implementations

## Next Steps

1. Implement `LIST_VIEWS` tool in your MCP server
2. Test with `bun run serve:server`
3. Verify views are loaded: check console for "✓ Loaded view: ..." messages
4. Create/edit views in DecoCMS and see them render immediately!

## Benefits

✅ **Vibecoding Workflow**: Edit views in DecoCMS → instant preview  
✅ **No Deployment**: Views update without redeploying the renderer  
✅ **Centralized**: All views managed in one place (DecoCMS)  
✅ **Type-Safe**: Views can be validated against content schemas  
✅ **Reusable**: Same views work for SSR and client-side rendering

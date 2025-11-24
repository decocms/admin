# Block Input Configuration Spec

## Problem

Blocks in pages need `input` data to render properly, but there's no UI in DecoCMS to configure this data. For example, a blog detail view needs a `postId` parameter.

## Solution: Add Input Schema to Views

### 1. Extend LIST_VIEWS Response

Add an `inputSchema` field to each view definition:

```json
{
  "views": [
    {
      "key": "blog-post-detail",
      "contentType": "post",
      "inputSchema": {
        "type": "object",
        "properties": {
          "postId": {
            "type": "string",
            "title": "Post ID",
            "description": "The ID of the blog post to display"
          }
        },
        "required": ["postId"]
      },
      "code": "..."
    }
  ]
}
```

### 2. Use JSON Schema for Input

The `inputSchema` should be a JSON Schema object that describes what data the view needs:

**Example: Blog Post Detail**
```json
{
  "inputSchema": {
    "type": "object",
    "properties": {
      "postId": {
        "type": "string",
        "title": "Post ID",
        "description": "The ID of the blog post to display"
      }
    },
    "required": ["postId"]
  }
}
```

**Example: Header with Navigation**
```json
{
  "inputSchema": {
    "type": "object",
    "properties": {
      "title": {
        "type": "string",
        "title": "Site Title",
        "default": "My Site"
      },
      "links": {
        "type": "array",
        "title": "Navigation Links",
        "items": {
          "type": "object",
          "properties": {
            "label": { "type": "string", "title": "Label" },
            "href": { "type": "string", "title": "URL" }
          }
        }
      }
    }
  }
}
```

**Example: HTML Block**
```json
{
  "inputSchema": {
    "type": "object",
    "properties": {
      "html": {
        "type": "string",
        "title": "HTML Content",
        "format": "html"
      },
      "className": {
        "type": "string",
        "title": "CSS Class"
      }
    },
    "required": ["html"]
  }
}
```

### 3. DecoCMS UI Implementation

When a user adds a block to a page, DecoCMS should:

1. **Fetch the view's input schema** from `LIST_VIEWS`
2. **Render a form** based on the JSON Schema
3. **Save the form data** as the block's `input` field

**UI Flow:**

```
User adds block → Select view → Form appears → Fill form → Save → Block has input data
```

**Example Form for Blog Post Detail:**

```
┌─────────────────────────────────────┐
│ Configure Block: blog-post-detail   │
├─────────────────────────────────────┤
│                                     │
│ Post ID *                           │
│ ┌─────────────────────────────────┐ │
│ │ post-123                        │ │
│ └─────────────────────────────────┘ │
│ The ID of the blog post to display  │
│                                     │
│ [Cancel]              [Save Block]  │
└─────────────────────────────────────┘
```

### 4. Dynamic Input (Advanced)

For blocks that fetch their own data, use `inputType: "dynamic"`:

```json
{
  "contentType": "blog-post-detail",
  "id": "post-detail-1",
  "inputType": "dynamic",
  "input": {
    "tool": "GET_CONTENT",
    "args": {
      "id": "post-123",
      "type": "post"
    }
  }
}
```

The renderer will call `GET_CONTENT` with those args to fetch the actual post data.

### 5. Implementation in DecoCMS

**Step 1: Update LIST_VIEWS to include inputSchema**

```typescript
{
  key: "blog-post-detail",
  contentType: "post",
  inputSchema: {
    type: "object",
    properties: {
      postId: {
        type: "string",
        title: "Post ID",
        description: "The ID of the blog post to display"
      }
    },
    required: ["postId"]
  },
  code: `
    // Fetch the post using the postId from input
    const postId = data.postId;
    // In a real implementation, you'd fetch from database
    // For now, return a placeholder
    return \`<div>Post ID: \${postId}</div>\`;
  `
}
```

**Step 2: Create a Block Configuration UI**

Use a library like `react-jsonschema-form` or build a custom form generator:

```tsx
import Form from '@rjsf/core';

function BlockConfigForm({ view, onSave }) {
  const handleSubmit = ({ formData }) => {
    onSave({
      contentType: view.contentType,
      id: generateId(),
      input: formData
    });
  };

  return (
    <Form
      schema={view.inputSchema}
      onSubmit={handleSubmit}
    />
  );
}
```

**Step 3: Save Block with Input**

When saving a page, include the input data:

```json
{
  "page": {
    "title": "Blog Post",
    "path": "/blog/my-post",
    "blocks": [
      {
        "contentType": "blog-post-detail",
        "id": "post-detail-1",
        "input": {
          "postId": "post-123"
        }
      }
    ]
  }
}
```

### 6. Example: Complete Blog Post Detail View

```json
{
  "key": "blog-post-detail",
  "contentType": "post",
  "inputSchema": {
    "type": "object",
    "properties": {
      "postId": {
        "type": "string",
        "title": "Post ID",
        "description": "The ID of the blog post to display"
      }
    },
    "required": ["postId"]
  },
  "code": `
    const postId = data.postId;
    
    // In production, fetch from database
    // For demo, return structured HTML
    return \`
      <article class="blog-post">
        <h1>Blog Post \${postId}</h1>
        <div class="content">
          <p>Content for post \${postId} would go here.</p>
        </div>
      </article>
    \`;
  `
}
```

### 7. Benefits

✅ **Type-safe input**: JSON Schema validates input data  
✅ **Auto-generated forms**: No manual form building  
✅ **Self-documenting**: Schema describes what each field does  
✅ **Reusable**: Same view can be used with different input  
✅ **Dynamic**: Can fetch data at render time if needed

### 8. Quick Fix for Current Issue

For the blog detail page showing "No Post ID", add this to your MCP server:

```typescript
// In GET_PAGE_CONTENT_FOR_PATH for /blog/:postId
{
  "page": {
    "title": "Blog Post",
    "path": "/blog/post-123",
    "blocks": [
      {
        "contentType": "blog-post-detail",
        "id": "detail-1",
        "input": {
          "postId": "post-123"  // ← Add this!
        }
      }
    ]
  }
}
```

Or use dynamic input:

```typescript
{
  "contentType": "blog-post-detail",
  "id": "detail-1",
  "inputType": "dynamic",
  "input": {
    "tool": "GET_CONTENT",
    "args": {
      "id": "post-123",
      "type": "post"
    }
  }
}
```

The renderer will call `GET_CONTENT` and pass the result as `data` to the view.

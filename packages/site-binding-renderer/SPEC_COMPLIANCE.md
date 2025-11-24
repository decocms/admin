# SITE Binding Spec Compliance Issue

## Problem

Your MCP server's `GET_PAGE_CONTENT_FOR_PATH` tool is returning blocks with a `type` field instead of `contentType`. This violates the SITE binding specification.

## Current (Incorrect) Response

```json
{
  "page": {
    "blocks": [
      {
        "type": "header",        // ❌ WRONG - should be "contentType"
        "id": "main-header"
      }
    ]
  }
}
```

## Required (Correct) Response

```json
{
  "page": {
    "blocks": [
      {
        "contentType": "header",  // ✅ CORRECT
        "id": "main-header"
      }
    ]
  }
}
```

## SITE Binding Spec

According to the SITE binding specification, each `ContentBlock` must have:
- `id` (string) - Unique identifier for the block
- `contentType` (string) - The type of content (e.g., "header", "footer", "html")
- `input` (optional object) - Static configuration or data for the block
- `inputType` (optional "static" | "dynamic") - Whether input is static or fetched dynamically
- `viewId` (optional string) - Specific view implementation to use

## Fix Required

Update your `GET_PAGE_CONTENT_FOR_PATH` tool implementation to return blocks with `contentType` instead of `type`:

```typescript
// Change this:
{
  type: "header",
  id: "main-header"
}

// To this:
{
  contentType: "header",
  id: "main-header"
}
```

## Verification

Run the integration tests to verify compliance:

```bash
cd packages/site-binding-renderer
export MCP_SERVER_TOKEN=$(grep DECOCMS_GUI_COOKIE ../../.cookie.mcp | cut -d'=' -f2-)
bun test src/tests/integration.test.ts
```

The test will now fail with a clear message indicating which blocks are missing the `contentType` field.

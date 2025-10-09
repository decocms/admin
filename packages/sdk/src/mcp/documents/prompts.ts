/**
 * Document Resource V2 Prompts
 *
 * These prompts provide detailed descriptions for Resources 2.0 operations
 * on documents, including creation, reading, updating, and management.
 */

export const DOCUMENT_SEARCH_PROMPT = `Search documents in the workspace.

This operation allows you to find documents by name, content, description, or tags.
Documents are markdown-formatted text content that can be used for documentation,
notes, guides, or any other text-based information.

Use this to discover existing documents before creating new ones or to find documents
for reading or modification.`;

export const DOCUMENT_READ_PROMPT = `Read a document's content and metadata.

Returns:
- Document metadata (name, description, tags)
- Full markdown content
- Creation and modification timestamps

Documents support standard markdown syntax including:
- Headers (# ## ###)
- Lists (ordered and unordered)
- Links and images
- Code blocks with syntax highlighting
- Tables, blockquotes, and more`;

export const DOCUMENT_CREATE_PROMPT = `Create a new document with markdown content.

## Document Structure

Documents consist of:
- **name**: A clear, descriptive title for the document
- **description** (optional): A brief summary of the document's purpose
- **content**: Markdown-formatted text content
- **tags** (optional): Array of strings for categorization

## Markdown Support

Documents support full markdown syntax:

\`\`\`markdown
# Main Header

## Subheader

This is **bold** and this is *italic*.

- Bullet point 1
- Bullet point 2

1. Numbered item
2. Another item

[Link text](https://example.com)

\`\`\`code
Code blocks with syntax highlighting
\`\`\`

> Blockquotes

| Table | Headers |
|-------|---------|
| Data  | Data    |
\`\`\`

## Best Practices

1. **Use clear names** - Make document titles descriptive and searchable
2. **Add descriptions** - Help others understand the document's purpose
3. **Structure content** - Use headers to organize long documents
4. **Tag appropriately** - Use tags for easier discovery and organization
5. **Keep it readable** - Use markdown formatting to enhance readability`;

export const DOCUMENT_UPDATE_PROMPT = `Update a document's content or metadata.

You can update any of the following:
- **name**: Change the document title
- **description**: Update the document's summary
- **content**: Modify the markdown content
- **tags**: Add, remove, or change tags

## Update Guidelines

1. **Preserve formatting** - Maintain markdown structure when editing content
2. **Update incrementally** - Make focused changes rather than rewriting everything
3. **Use clear descriptions** - Keep descriptions concise and informative
4. **Manage tags thoughtfully** - Add relevant tags, remove outdated ones

## Common Update Patterns

**Adding content:**
- Append new sections to existing content
- Insert new information in appropriate locations
- Maintain document structure and flow

**Fixing content:**
- Correct typos and formatting issues
- Update outdated information
- Improve clarity and readability

**Reorganizing:**
- Restructure headers and sections
- Reorder content for better flow
- Split or merge sections as needed`;

export const DOCUMENT_DELETE_PROMPT = `Delete a document from the workspace.

This operation permanently removes the document file from the DECONFIG storage.
Use this to clean up obsolete, duplicate, or unwanted documents.

Warning: This action cannot be undone. The document will be permanently removed
from the workspace.`;

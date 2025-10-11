/**
 * View Resource V2 Prompts
 *
 * These prompts provide detailed descriptions for Resources 2.0 operations
 * on views, including creation, reading, updating, and management.
 */

export const VIEW_SEARCH_PROMPT = `Search views in the workspace.

This operation allows you to find views by name, description, or tags.
Views are HTML-based UI components that can be rendered in iframes to create
custom interfaces, dashboards, reports, or any other web-based visualization.

Use this to discover existing views before creating new ones or to find views
for reading or modification.`;

export const VIEW_READ_PROMPT = `Read a view's content and metadata.

Returns:
- View metadata (name, description, icon, tags)
- Full HTML content that can be rendered in an iframe
- Creation and modification timestamps

Views support:
- Full HTML5 with embedded CSS and JavaScript
- Responsive designs with modern CSS frameworks
- Interactive components with JavaScript
- External resources via CDN links
- Data visualization libraries (Chart.js, D3.js, etc.)

Security Notes:
- Views are rendered in isolated iframes with srcdoc
- External resources should use HTTPS URLs
- Be cautious with user-provided HTML to prevent XSS`;

export const VIEW_CREATE_PROMPT = `Create a new view with HTML content.

## View Structure

Views consist of:
- **name**: A clear, descriptive title for the view
- **description** (optional): A brief summary of the view's purpose
- **html**: Complete HTML document with CSS and JavaScript
- **icon** (optional): URL to an icon image for the view
- **tags** (optional): Array of strings for categorization

## HTML Content Guidelines

Views should be complete, self-contained HTML documents:

\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My View</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      padding: 20px;
      margin: 0;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>My Custom View</h1>
    <p>Content goes here...</p>
  </div>
  
  <script>
    // Add interactivity
    console.log('View loaded');
  </script>
</body>
</html>
\`\`\`

## Best Practices

1. **Self-contained documents** - Include all CSS and JavaScript inline or via CDN
2. **Responsive design** - Use viewport meta tags and responsive CSS
3. **Clear naming** - Make view titles descriptive and searchable
4. **Add descriptions** - Help others understand the view's purpose
5. **Use semantic HTML** - Proper HTML structure for accessibility
6. **Tag appropriately** - Use tags for easier discovery and organization
7. **Consider mobile** - Design views that work on different screen sizes
8. **External resources** - Use CDN links for libraries (Chart.js, Tailwind, etc.)

## Common Use Cases

**Dashboard View:**
- Display key metrics and charts
- Use libraries like Chart.js or Recharts
- Auto-refresh with JavaScript timers

**Report View:**
- Present data in tables and visualizations
- Export functionality (print, PDF)
- Filterable and sortable content

**Form View:**
- Custom input forms for data collection
- Client-side validation
- Integration with backend APIs

**Admin Panel:**
- Management interfaces
- CRUD operations
- User-friendly controls`;

export const VIEW_UPDATE_PROMPT = `Update a view's content or metadata.

You can update any of the following:
- **name**: Change the view title
- **description**: Update the view's summary
- **html**: Modify the HTML content
- **icon**: Change the icon URL
- **tags**: Add, remove, or change tags

## Update Guidelines

1. **Preserve structure** - Maintain valid HTML when editing content
2. **Update incrementally** - Make focused changes rather than rewriting everything
3. **Test changes** - Verify HTML renders correctly after updates
4. **Version comments** - Add HTML comments to track major changes
5. **Manage tags thoughtfully** - Add relevant tags, remove outdated ones

## Common Update Patterns

**Updating content:**
- Modify text, headings, or layout
- Add new sections or components
- Update data visualizations
- Fix styling issues

**Adding functionality:**
- Include new JavaScript features
- Add event listeners and interactivity
- Integrate new libraries via CDN
- Enhance responsiveness

**Improving design:**
- Update CSS styles
- Modernize layout
- Improve accessibility
- Optimize for performance`;

export const VIEW_DELETE_PROMPT = `Delete a view from the workspace.

This operation permanently removes the view file from the DECONFIG storage.
Use this to clean up obsolete, duplicate, or unwanted views.

Warning: This action cannot be undone. The view will be permanently removed
from the workspace. Make sure you have a backup if needed.`;

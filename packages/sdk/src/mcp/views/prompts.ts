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
- React component code (code field)
- Creation and modification timestamps

The code contains only the React component definition (e.g., \`export const App = () => { ... }\`).

The frontend will automatically wrap this code in a complete HTML template with:
- React-compatible runtime with automatic JSX transform
- Tailwind CSS v4 design tokens
- Global \`callTool(params)\` function for invoking tools
  - Takes an object with \`toolName\` (string) and \`input\` (object) properties
  - Supports both regular tools (e.g., \`"INTEGRATIONS_LIST"\`) and resource tools (URIs like \`"rsc://integration/tool/NAME"\`)
  - Both types are called the same way - the API handles routing
  - Example: \`await callTool({ toolName: 'INTEGRATIONS_LIST', input: {} })\`

Security Notes:
- Views are rendered in isolated iframes with sandbox attributes
- External resources are loaded from trusted CDNs
- Component code is validated before execution`;

export const VIEW_CREATE_PROMPT = `Create a new view with React code.

## View Structure

Views consist of:
- **name**: A clear, descriptive title for the view
- **description** (optional): A brief summary of the view's purpose
- **code**: React component code that defines the App component
- **icon** (optional): URL to an icon image for the view
- **tags** (optional): Array of strings for categorization
- **importmap** (optional): Custom import map for additional modules (defaults to React 19.2.0)

## React Component Guidelines

**You only need to write the React component code. The system provides:**
- ✅ React-compatible runtime with automatic JSX transform (no \`import React\` needed)
- ✅ Tailwind CSS v4 design tokens (already available)
- ✅ Global \`callTool({ toolName, input })\` function (supports regular and resource tools - always available)
- ✅ Import maps for React modules

**Your code must define an App component and import React hooks:**

\`\`\`jsx
import { useState } from 'react';

export const App = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await callTool({
        toolName: 'INTEGRATIONS_LIST',
        input: {}
      });
      setData(result);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">My View</h1>
      <button 
        onClick={fetchData}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        Load Data
      </button>
      {loading && <p className="mt-4">Loading...</p>}
      {data && <pre className="mt-4 p-4 bg-gray-100 rounded">{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
};
\`\`\`

## Available Imports

Import React hooks and utilities from 'react':

\`\`\`jsx
import { useState, useEffect, useCallback, useMemo, useRef, useContext, createContext } from 'react';
\`\`\`

The following modules are available via import maps by default:
- \`react\` - React 19.2.0
- \`react-dom\` - React DOM 19.2.0
- \`react-dom/client\` - React DOM client APIs

## Custom Import Maps (Advanced)

You can optionally provide a custom \`importmap\` to add additional libraries:

\`\`\`json
{
  "importmap": {
    "lodash": "https://esm.sh/lodash@4.17.21",
    "date-fns": "https://esm.sh/date-fns@3.0.0"
  }
}
\`\`\`

Then use these libraries in your component:

\`\`\`jsx
import { useState } from 'react';
import { groupBy } from 'lodash';
import { format } from 'date-fns';

export const App = () => {
  // Use imported libraries
  const formattedDate = format(new Date(), 'yyyy-MM-dd');
  // ...
};
\`\`\`

**Note:** The default React imports are always available and will be merged with your custom imports.

## Calling Tools

Use the global \`callTool()\` function to invoke any tool. This function is **always available** and doesn't need to be imported.

### API Signature

\`\`\`typescript
callTool(params: {
  toolName: string;  // Required: Tool name or resource URI
  input: object;     // Required: Parameters for the tool (use {} if none needed)
}): Promise<any>
\`\`\`

### Tool Types

Both types of tools are called the same way, but serve different purposes:

**Regular Tools** - Standard workspace tools (most common):
- Use the tool name directly (e.g., \`"INTEGRATIONS_LIST"\`)
- Workspace-specific tools from installed integrations
- Most integration tools fall into this category

**Resource Tools** - Tools that operate on resources (advanced):
- Use a resource URI starting with \`rsc://\` (e.g., \`"rsc://tools-management/tool/TOOL_SEARCH"\`)
- Dynamic tools that work with workspace resources
- Used for CRUD operations on resources like tools, workflows, documents, etc.

### Usage Examples

**Regular tool call (most common):**
\`\`\`jsx
// Call a regular workspace tool
const integrations = await callTool({
  toolName: 'INTEGRATIONS_LIST',
  input: {}  // Empty object when tool requires no parameters
});
\`\`\`

**Regular tool with parameters:**
\`\`\`jsx
const user = await callTool({
  toolName: 'USER_GET',
  input: {
    userId: '123',
    includeProfile: true
  }
});
\`\`\`

**Resource tool call (advanced):**
\`\`\`jsx
// Call a resource tool using URI
const tools = await callTool({
  toolName: 'rsc://tools-management/tool/TOOL_SEARCH',
  input: { query: 'database' }
});
\`\`\`

**With error handling:**
\`\`\`jsx
try {
  const result = await callTool({
    toolName: 'DATA_PROCESS',
    input: { data: myData }
  });
  console.log('Success:', result);
} catch (error) {
  console.error('Tool call failed:', error.message);
}
\`\`\`

### Important Notes

- Both \`toolName\` and \`input\` are **required** parameters
- \`toolName\` must be a string:
  - **Regular tools**: Use the tool name directly (e.g., \`"INTEGRATIONS_LIST"\`)
  - **Resource tools**: Use a URI starting with \`rsc://\` (e.g., \`"rsc://tools-management/tool/TOOL_SEARCH"\`)
- \`input\` must be an object (not an array). Use \`{}\` if the tool needs no parameters
- Both regular and resource tools are called the same way - the API handles routing automatically
- The function returns a Promise that resolves with the tool's result
- Errors are thrown if parameters are invalid or if the API call fails

**For complete tool calling documentation, refer to the TOOL_CALL.md guide.**

## Styling with Tailwind CSS v4

Use Tailwind utility classes directly in your JSX:

\`\`\`jsx
<div className="flex items-center gap-4 p-6 bg-white rounded-lg shadow-md">
  <h2 className="text-xl font-semibold text-gray-800">Hello World</h2>
  <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition">
    Click me
  </button>
</div>
\`\`\`

## Best Practices

1. **Import hooks** - Always import React hooks you need: \`import { useState, useEffect } from 'react'\`
2. **Define App component** - Always define \`export const App = () => { ... }\`
3. **Use Tailwind classes** - Leverage Tailwind CSS for styling instead of custom CSS
4. **Handle loading states** - Show feedback when calling tools
5. **Error handling** - Use try/catch when calling tools
6. **Clear naming** - Make view titles descriptive and searchable
7. **Add descriptions** - Help others understand the view's purpose
8. **Tag appropriately** - Use tags for easier discovery and organization
9. **Keep it simple** - Focus on the component logic, not boilerplate

## Common Use Cases

**Dashboard View:**
\`\`\`jsx
import { useState, useEffect } from 'react';

export const App = () => {
  const [metrics, setMetrics] = useState(null);
  
  useEffect(() => {
    const loadMetrics = async () => {
      const data = await callTool({
        toolName: 'GET_METRICS',
        input: {}
      });
      setMetrics(data);
    };
    loadMetrics();
  }, []);
  
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-3 gap-4">
        {metrics?.map((metric, i) => (
          <div key={i} className="p-4 bg-white rounded shadow">
            <div className="text-2xl font-bold">{metric.value}</div>
            <div className="text-gray-600">{metric.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
\`\`\`

**Interactive Form:**
\`\`\`jsx
import { useState } from 'react';

export const App = () => {
  const [formData, setFormData] = useState({ name: '', email: '' });
  const [result, setResult] = useState(null);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await callTool({
      toolName: 'SUBMIT_FORM',
      input: formData
    });
    setResult(res);
  };
  
  return (
    <div className="p-6 max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
          className="w-full px-4 py-2 border rounded"
          placeholder="Name"
        />
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({...formData, email: e.target.value})}
          className="w-full px-4 py-2 border rounded"
          placeholder="Email"
        />
        <button 
          type="submit"
          className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Submit
        </button>
      </form>
      {result && <div className="mt-4 p-4 bg-green-100 rounded">{JSON.stringify(result)}</div>}
    </div>
  );
};
\`\`\``;

export const VIEW_UPDATE_PROMPT = `Update a view's content or metadata.

You can update any of the following:
- **name**: Change the view title
- **description**: Update the view's summary
- **code**: Modify the React component code
- **icon**: Change the icon URL
- **tags**: Add, remove, or change tags
- **importmap**: Add or modify custom module imports

## Update Guidelines

1. **Preserve imports** - Ensure necessary React hooks are imported from 'react'
2. **Preserve App component** - Always keep the \`export const App = () => { ... }\` definition
3. **Update incrementally** - Make focused changes rather than rewriting everything
4. **Test changes** - Verify the component renders correctly after updates
5. **Use Tailwind classes** - Leverage Tailwind CSS for styling
6. **Manage tags thoughtfully** - Add relevant tags, remove outdated ones

## Common Update Patterns

**Updating content:**
- Modify JSX structure and layout
- Add new sections or UI elements
- Update data visualizations
- Fix styling with Tailwind classes

**Adding functionality:**
- Import new React hooks if needed: \`import { useState, useEffect, ... } from 'react'\`
- Include new state and effects
- Add event handlers and interactivity
- Integrate tool calls with \`callTool({ toolName: 'TOOL_NAME', input: {} })\`
- Enhance user interactions

**Improving design:**
- Update Tailwind utility classes
- Modernize component layout
- Improve responsiveness with Tailwind breakpoints
- Optimize rendering performance`;

export const VIEW_DELETE_PROMPT = `Delete a view from the workspace.

This operation permanently removes the view file from the DECONFIG storage.
Use this to clean up obsolete, duplicate, or unwanted views.

Warning: This action cannot be undone. The view will be permanently removed
from the workspace. Make sure you have a backup if needed.`;

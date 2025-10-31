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
- Input schema (inputSchema field, optional) - JSON Schema defining expected input data structure
- Creation and modification timestamps

The code contains only the React component definition (e.g., \`export const App = (props) => { ... }\`).

The frontend will automatically wrap this code in a complete HTML template with:
- React-compatible runtime with automatic JSX transform
- Tailwind CSS v4 design tokens
- **Input data as props** - The App component receives any input data (e.g., workflow step output) as props
- Global \`callTool(params)\` function for invoking tools
  - Takes an object with \`integrationId\` (string), \`toolName\` (string), and \`input\` (object, required) properties
  - Always calls INTEGRATIONS_CALL_TOOL internally
  - Example: \`await callTool({ integrationId: 'i:integration-management', toolName: 'INTEGRATIONS_LIST', input: {} })\`

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
- **inputSchema** (optional): JSON Schema (draft-07) defining expected input data structure
- **icon** (optional): URL to an icon image for the view
- **tags** (optional): Array of strings for categorization
- **importmap** (optional): Custom import map for additional modules (defaults to React 19.2.0)

## Input Schema (Props Definition)

Views can receive input data via props. The **inputSchema** field lets you define what data your view expects using JSON Schema format.

**When to use inputSchema:**
- ✅ View receives data from workflow steps
- ✅ View is called with specific parameters from other views or tools
- ✅ You want to document the expected props structure
- ✅ Enable type validation in workflows
- ✅ Help AI assistants understand your view's data requirements

**Input Schema Example:**

\`\`\`json
{
  "inputSchema": {
    "type": "object",
    "properties": {
      "userId": {
        "type": "string",
        "description": "The ID of the user to display"
      },
      "metrics": {
        "type": "array",
        "description": "Array of metric objects to display",
        "items": {
          "type": "object",
          "properties": {
            "label": { "type": "string" },
            "value": { "type": "number" }
          }
        }
      },
      "showDetails": {
        "type": "boolean",
        "description": "Whether to show detailed information",
        "default": false
      }
    },
    "required": ["userId"]
  }
}
\`\`\`

**Accessing input data in your component:**

\`\`\`jsx
export const App = (props) => {
  // Props are automatically typed based on inputSchema
  const { userId, metrics = [], showDetails = false } = props;
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">User: {userId}</h1>
      {showDetails && (
        <div className="mt-4">
          {metrics.map((metric, i) => (
            <div key={i} className="mb-2">
              <span className="font-semibold">{metric.label}:</span> {metric.value}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
\`\`\`

**Notes:**
- If no inputSchema is provided, the view can still receive props but they won't be validated
- Use JSON Schema draft-07 specification
- Props are passed via iframe postMessage when the view is rendered
- Default values can be defined in the schema and accessed in the component

## React Component Guidelines

**You only need to write the React component code. The system provides:**
- ✅ React-compatible runtime with automatic JSX transform (no \`import React\` needed)
- ✅ Tailwind CSS v4 design tokens (already available)
- ✅ **Input data as props** (e.g., from workflow step output, passed via iframe postMessage)
- ✅ Global \`callTool({ integrationId, toolName, input })\` function (always calls INTEGRATIONS_CALL_TOOL - always available)
- ✅ Import maps for React modules

**Your code must define an App component that receives props:**

\`\`\`jsx
import { useState } from 'react';

export const App = (props) => {
  // CRITICAL: Always log props on mount for debugging (views run in isolated iframes)
  console.log('[MyView] Component mounted with props:', props);
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const fetchData = async () => {
    setLoading(true);
    // Log before calling tools
    console.log('[MyView] Calling INTEGRATIONS_LIST tool');
    try {
      const result = await callTool({
        integrationId: 'i:integration-management',
        toolName: 'INTEGRATIONS_LIST',
        input: {}
      });
      // Log results
      console.log('[MyView] Tool result:', result);
      
      // IMPORTANT: Access via result.structuredContent.items
      const integrations = result.structuredContent?.items || [];
      console.log('[MyView] Found integrations:', integrations.length);
      setData(integrations);
    } catch (error) {
      // Log errors with context
      console.error('[MyView] Tool call failed:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div 
      className="p-6 min-h-screen"
      style={{ 
        backgroundColor: 'var(--background)', 
        color: 'var(--foreground)' 
      }}
    >
      <div 
        className="mb-6 p-6 rounded-[var(--radius)] border"
        style={{
          backgroundColor: 'var(--card)',
          borderColor: 'var(--border)'
        }}
      >
        <h1 
          className="text-2xl font-bold mb-2"
          style={{ color: 'var(--card-foreground)' }}
        >
          My View
        </h1>
      </div>
      
      <button 
        onClick={fetchData}
        className="px-4 py-2 rounded-[var(--radius)] font-medium"
        style={{
          backgroundColor: 'var(--primary)',
          color: 'var(--primary-foreground)'
        }}
      >
        {loading ? 'Loading...' : 'Load Data'}
      </button>
      
      {data && (
        <pre 
          className="mt-4 p-4 rounded-[var(--radius)] border overflow-auto"
          style={{
            backgroundColor: 'var(--muted)',
            color: 'var(--muted-foreground)',
            borderColor: 'var(--border)'
          }}
        >
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
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

Use the global \`callTool()\` function to invoke any tool. This function is **always available** and doesn't need to be imported. It always calls INTEGRATIONS_CALL_TOOL internally.

**CRITICAL: Always log tool calls for debugging** - Log before calling, after receiving results, and on errors with \`[ViewName]\` prefix.

### API Signature

\`\`\`typescript
callTool(params: {
  integrationId: string;  // Required: Integration ID (e.g., 'i:integration-management')
  toolName: string;       // Required: Tool name to call
  input: object;          // Required: Parameters for the tool (use {} if none needed)
}): Promise<any>
\`\`\`

### Common Integration IDs

- \`i:integration-management\` - Integration management (INTEGRATIONS_LIST, INTEGRATIONS_GET, etc.)
- \`i:databases-management\` - Database management
- \`i:agents-management\` - Agent management
- \`i:workflows-management\` - Workflow management
- Get other IDs from INTEGRATIONS_LIST tool

### Tool Response Structures

**CRITICAL: Understanding tool response formats is essential for writing correct code.**

The \`callTool\` function returns a response wrapper:
\`\`\`javascript
{
  content: [{ type: "text", text: "..." }],  // Human-readable text
  structuredContent: { /* actual typed data */ },  // THE DATA YOU WANT
  isError: boolean
}
\`\`\`

**ALWAYS access the actual data via \`result.structuredContent\`**, not the root level.

The \`structuredContent\` for Resources 2.0 tools follows these patterns:

**SEARCH operations** (e.g., INTEGRATIONS_LIST, DECO_RESOURCE_VIEW_SEARCH):
\`\`\`javascript
const result = await callTool({ integrationId: '...', toolName: 'INTEGRATIONS_LIST', input: {} });
// result.structuredContent contains:
{
  items: [{ uri, data: { name, description, ... }, created_at, updated_at }],
  totalCount: number,
  page: number,
  pageSize: number,
  totalPages: number,
  hasNextPage: boolean,
  hasPreviousPage: boolean
}
// Access: result.structuredContent.items (NOT result.items or result.results)
\`\`\`

**READ operations** (e.g., INTEGRATIONS_GET, DECO_RESOURCE_VIEW_READ):
\`\`\`javascript
const result = await callTool({ integrationId: '...', toolName: 'INTEGRATIONS_GET', input: { id } });
// result.structuredContent contains:
{
  uri: string,
  data: { name, description, ... }, // Full resource data
  created_at: string,
  updated_at: string
}
// Access: result.structuredContent.data
\`\`\`

**CREATE/UPDATE operations**:
\`\`\`javascript
const result = await callTool({ integrationId: '...', toolName: '...CREATE', input: { data } });
// result.structuredContent contains:
{
  uri: string,
  data: { name, description, ... }, // Created/updated resource data
  created_at: string,
  updated_at: string
}
// Access: result.structuredContent.data
\`\`\`

### Usage Examples with Proper Logging

**SEARCH operation example (LIST tool):**
\`\`\`jsx
console.log('[MyView] Calling INTEGRATIONS_LIST');
try {
  const result = await callTool({
    integrationId: 'i:integration-management',
    toolName: 'INTEGRATIONS_LIST',
    input: {}
  });
  console.log('[MyView] Got result:', result);
  
  // IMPORTANT: Access via result.structuredContent.items
  const integrations = result.structuredContent?.items || [];
  console.log('[MyView] Found integrations:', integrations.length);
  
  integrations.forEach(item => {
    // Each item has: { uri, data: { name, description, ... }, created_at, updated_at }
    console.log('[MyView] Integration:', item.data.name);
  });
} catch (error) {
  console.error('[MyView] Failed to fetch integrations:', error);
}
\`\`\`

**READ operation example (GET tool):**
\`\`\`jsx
console.log('[MyView] Fetching integration:', integrationId);
try {
  const result = await callTool({
    integrationId: 'i:integration-management',
    toolName: 'INTEGRATIONS_GET',
    input: { id: integrationId }
  });
  console.log('[MyView] Got result:', result);
  
  // IMPORTANT: Access via result.structuredContent.data
  const integration = result.structuredContent?.data;
  console.log('[MyView] Integration name:', integration.name);
  console.log('[MyView] Integration tools:', integration.tools);
} catch (error) {
  console.error('[MyView] Failed to load integration:', error);
}
\`\`\`

### Important Notes

- \`integrationId\`, \`toolName\`, and \`input\` are **required** parameters
- \`input\` must be an object (not an array) - use \`{}\` if the tool needs no parameters
- **ALWAYS access data via \`result.structuredContent\`** - the actual typed data is there, not at the root
- Always log tool calls for debugging (before/after/errors)
- Use INTEGRATIONS_LIST to discover available integrations and their IDs
- Handle \`result.isError\` to detect tool errors

## Styling with Tailwind CSS v4

Use Tailwind utility classes directly in your JSX. **Important: Always use theme tokens (CSS custom properties) for colors and design tokens** to ensure your view automatically adapts to workspace theme changes.

### Theme Tokens (CSS Custom Properties)

Views automatically inherit workspace theme variables. Use these tokens for consistent, theme-aware styling:

**Color Tokens:**
- \`--background\`, \`--foreground\` - Main page colors
- \`--card\`, \`--card-foreground\` - Card/panel colors
- \`--primary\`, \`--primary-foreground\` - Primary brand colors
- \`--secondary\`, \`--secondary-foreground\` - Secondary UI colors
- \`--muted\`, \`--muted-foreground\` - Subtle backgrounds and disabled states
- \`--accent\`, \`--accent-foreground\` - Highlights and hover states
- \`--destructive\`, \`--destructive-foreground\` - Error/delete states
- \`--success\`, \`--success-foreground\` - Success/confirmation states
- \`--warning\`, \`--warning-foreground\` - Warning/caution states
- \`--border\`, \`--input\`, \`--ring\` - Borders, inputs, focus rings

**Layout Tokens:**
- \`--radius\` - Border radius for rounded corners
- \`--spacing\` - Base spacing unit

**Using Theme Tokens in Tailwind:**

\`\`\`jsx
// ✅ Good - Uses theme tokens
<div className="bg-[var(--card)] text-[var(--card-foreground)] border border-[var(--border)] rounded-[var(--radius)] p-6">
  <h2 className="text-xl font-semibold">Hello World</h2>
  <button 
    className="px-4 py-2 rounded-[var(--radius)]"
    style={{
      backgroundColor: 'var(--primary)',
      color: 'var(--primary-foreground)'
    }}
  >
    Primary Action
  </button>
  <button 
    className="px-4 py-2 rounded-[var(--radius)] border"
    style={{
      backgroundColor: 'var(--destructive)',
      color: 'var(--destructive-foreground)',
      borderColor: 'var(--border)'
    }}
  >
    Delete
  </button>
</div>

// ❌ Bad - Hardcoded colors won't adapt to theme changes
<div className="bg-white text-black border-gray-300 rounded-lg p-6">
  <h2 className="text-xl font-semibold text-gray-800">Hello World</h2>
  <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
    Click me
  </button>
</div>
\`\`\`

## Debugging & Console Logs

**CRITICAL: Always include comprehensive console logs for debugging.** Views run in isolated iframes, making debugging difficult without proper logging.

**What to log with \`[ViewName]\` prefix:**
1. **Props on mount** - \`console.log('[ViewName] Component mounted with props:', props);\`
2. **Tool calls** - Before calling, after results, and on errors (see examples above)
3. **State changes** - \`console.log('[ViewName] State updated:', newState);\`
4. **Data transformations** - Log before/after processing
5. **Error conditions** - \`console.error('[ViewName] Error:', error);\`

**Log naming convention:** Always prefix logs with \`[ViewName]\` for easy filtering in browser console.

### Basecoat UI - HTML-only Components

Since views run in the browser without a build step, you cannot use React-based shadcn/ui components. Instead, use **Basecoat UI** (https://basecoatui.com/), which provides HTML-only versions of shadcn components that work perfectly with theme tokens.

**Example with Basecoat patterns:**

\`\`\`jsx
<div className="space-y-4">
  {/* Card using theme tokens */}
  <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius)] p-6">
    <h3 className="text-lg font-bold text-[var(--card-foreground)] mb-2">
      Card Title
    </h3>
    <p className="text-[var(--muted-foreground)]">
      Card description text
    </p>
  </div>

  {/* Status badges using theme tokens */}
  <div className="flex gap-2">
    <span 
      className="px-3 py-1 rounded-[var(--radius)] text-sm font-medium"
      style={{
        backgroundColor: 'var(--success)',
        color: 'var(--success-foreground)'
      }}
    >
      Active
    </span>
    <span 
      className="px-3 py-1 rounded-[var(--radius)] text-sm font-medium"
      style={{
        backgroundColor: 'var(--warning)',
        color: 'var(--warning-foreground)'
      }}
    >
      Pending
    </span>
  </div>
</div>
\`\`\`

## Best Practices

**Critical (Always Required):**
1. **Add console logs** - ALWAYS log props on mount, tool calls (before/after/errors), state changes, and errors with \`[ViewName]\` prefix
2. **Use theme tokens** - ALWAYS use CSS custom properties (\`var(--primary)\`, \`var(--card)\`, etc.) instead of hardcoded colors
3. **Define App component** - Always define \`export const App = (props) => { ... }\` and import needed React hooks
4. **Error handling** - Use try/catch when calling tools and log errors

**Component Structure:**
5. **Access props data** - Use props to access input data passed to the view (e.g., from workflow steps)
6. **Define inputSchema** - When your view expects specific props, define an inputSchema for validation and documentation
7. **Provide defaults** - Handle missing or undefined props gracefully with default values
8. **Handle loading states** - Show feedback when calling tools

**Styling & Design:**
9. **Semantic tokens** - Use \`--destructive\` for delete, \`--success\` for confirmations, \`--warning\` for caution, \`--muted\` for disabled
10. **Leverage Basecoat UI** - Use Basecoat UI patterns (https://basecoatui.com/) for consistent components
11. **Maintain accessibility** - Use \`--ring\` for focus states, ensure proper contrast

**Organization:**
12. **Clear naming** - Make view titles descriptive and searchable
13. **Add descriptions** - Help others understand the view's purpose
14. **Tag appropriately** - Use tags for easier discovery and organization

## Common Use Cases

**View with Input Schema (Workflow Integration):**
\`\`\`json
{
  "name": "User Profile Display",
  "description": "Displays user profile information from workflow data",
  "inputSchema": {
    "type": "object",
    "properties": {
      "user": {
        "type": "object",
        "description": "User data object",
        "properties": {
          "id": { "type": "string" },
          "name": { "type": "string" },
          "email": { "type": "string" },
          "role": { "type": "string" }
        },
        "required": ["id", "name", "email"]
      },
      "showActions": {
        "type": "boolean",
        "description": "Whether to show action buttons",
        "default": false
      }
    },
    "required": ["user"]
  },
  "code": "..."
}
\`\`\`

\`\`\`jsx
import { useState } from 'react';

export const App = (props) => {
  console.log('[UserProfile] Component mounted with props:', props);
  
  const { user, showActions = false } = props;
  const [isEditing, setIsEditing] = useState(false);
  
  if (!user) {
    console.error('[UserProfile] Missing required prop: user');
    return (
      <div className="p-6 text-center text-gray-500">
        No user data provided
      </div>
    );
  }
  
  const handleEditToggle = () => {
    console.log('[UserProfile] Edit mode toggled:', !isEditing);
    setIsEditing(!isEditing);
  };
  
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{user.name}</h1>
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
            {user.role}
          </span>
        </div>
        
        <div className="space-y-2">
          <p className="text-gray-600">
            <span className="font-semibold">Email:</span> {user.email}
          </p>
          <p className="text-gray-600">
            <span className="font-semibold">ID:</span> {user.id}
          </p>
        </div>
        
        {showActions && (
          <div className="flex gap-2 pt-4 border-t">
            <button
              onClick={handleEditToggle}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              {isEditing ? 'Cancel' : 'Edit'}
            </button>
            <button className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
\`\`\`

**Dashboard View:**
\`\`\`jsx
import { useState, useEffect } from 'react';

export const App = (props) => {
  console.log('[Dashboard] Component mounted with props:', props);
  
  // Use props.metrics if provided, otherwise fetch from API
  const [metrics, setMetrics] = useState(props.metrics || null);
  
  useEffect(() => {
    if (!props.metrics) {
      console.log('[Dashboard] No metrics in props, fetching from API');
      const loadMetrics = async () => {
        try {
          console.log('[Dashboard] Calling GET_METRICS tool');
          const result = await callTool({
            integrationId: 'i:integration-management',
            toolName: 'GET_METRICS',
            input: {}
          });
          console.log('[Dashboard] Metrics loaded:', result);
          // Access via result.structuredContent
          setMetrics(result.structuredContent);
        } catch (error) {
          console.error('[Dashboard] Failed to load metrics:', error);
        }
      };
      loadMetrics();
    } else {
      console.log('[Dashboard] Using metrics from props:', props.metrics);
    }
  }, [props.metrics]);
  
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

export const App = (props) => {
  console.log('[InteractiveForm] Component mounted with props:', props);
  
  // Pre-populate form with props.initialData if provided
  const initialData = props.initialData || { name: '', email: '' };
  console.log('[InteractiveForm] Initial form data:', initialData);
  
  const [formData, setFormData] = useState(initialData);
  const [result, setResult] = useState(null);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('[InteractiveForm] Form submitted with data:', formData);
    
    try {
      console.log('[InteractiveForm] Calling SUBMIT_FORM tool');
      const result = await callTool({
        integrationId: 'i:integration-management',
        toolName: 'SUBMIT_FORM',
        input: formData
      });
      console.log('[InteractiveForm] Form submission result:', result);
      // Access via result.structuredContent
      setResult(result.structuredContent);
    } catch (error) {
      console.error('[InteractiveForm] Form submission failed:', error);
    }
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
- **inputSchema**: Add, modify, or remove the input schema (JSON Schema defining expected props)
- **icon**: Change the icon URL
- **tags**: Add, remove, or change tags
- **importmap**: Add or modify custom module imports

## Update Guidelines

1. **Preserve structure** - Keep \`export const App = (props) => { ... }\` definition and necessary React imports
2. **Preserve/add console logs** - ALWAYS ensure comprehensive logging is present. Add logs for props (on mount), tool calls (before/after/errors), state changes, and error conditions with \`[ViewName]\` prefix
3. **Use theme tokens** - ALWAYS use CSS custom properties (\`var(--primary)\`, \`var(--card)\`, etc.) instead of hardcoded colors for theme consistency
4. **Handle props properly** - Ensure component receives and uses props correctly if input data is needed
5. **Update incrementally** - Make focused changes rather than rewriting everything
6. **Manage tags thoughtfully** - Add relevant tags, remove outdated ones

## Common Update Patterns

**Updating content:**
- Modify JSX structure and layout
- Add new sections or UI elements
- Update data visualizations
- Style with Tailwind + theme tokens: \`className="bg-[var(--card)] text-[var(--card-foreground)] rounded-[var(--radius)]"\`

**Adding functionality:**
- Import React hooks: \`import { useState, useEffect } from 'react'\`
- Add state, effects, and event handlers
- Integrate tool calls: \`callTool({ integrationId: 'i:...', toolName: 'TOOL_NAME', input: {} })\`
- Add logging for new tool calls and state changes

**Improving design:**
- Replace hardcoded colors with theme tokens (\`--primary\`, \`--destructive\`, \`--success\`, etc.)
- Use Basecoat UI patterns (https://basecoatui.com/) for consistent components
- Improve responsiveness with Tailwind breakpoints
- Ensure proper semantic token usage (\`--destructive\` for delete, \`--success\` for confirmations)`;

export const VIEW_DELETE_PROMPT = `Delete a view from the workspace.

This operation permanently removes the view file from the DECONFIG storage.
Use this to clean up obsolete, duplicate, or unwanted views.

Warning: This action cannot be undone. The view will be permanently removed
from the workspace. Make sure you have a backup if needed.`;

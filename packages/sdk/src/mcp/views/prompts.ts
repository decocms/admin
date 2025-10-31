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
  // ALWAYS log props on mount for debugging
  console.log('[MyView] Component mounted with props:', props);
  
  // Access any input data passed to the view via props
  // For example, from a workflow step: props.stepOutput, props.data, etc.
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const fetchData = async () => {
    setLoading(true);
    console.log('[MyView] Calling INTEGRATIONS_LIST tool');
    try {
      const result = await callTool({
        integrationId: 'i:integration-management',
        toolName: 'INTEGRATIONS_LIST',
        input: {}
      });
      console.log('[MyView] Tool result:', result);
      setData(result);
    } catch (error) {
      console.error('[MyView] Tool call failed:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">My View</h1>
      {/* Display input data if provided */}
      {Object.keys(props).length > 0 && (
        <div className="mb-4 p-4 bg-gray-50 rounded border">
          <h2 className="font-semibold mb-2">Input Data:</h2>
          <pre className="text-xs">{JSON.stringify(props, null, 2)}</pre>
        </div>
      )}
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

Use the global \`callTool()\` function to invoke any tool. This function is **always available** and doesn't need to be imported. It always calls INTEGRATIONS_CALL_TOOL internally.

### API Signature

\`\`\`typescript
callTool(params: {
  integrationId: string;  // Required: Integration ID (e.g., 'i:integration-management')
  toolName: string;       // Required: Tool name to call
  input: object;          // Required: Parameters for the tool (use {} if none needed)
}): Promise<any>
\`\`\`

### Getting Integration IDs

To call a tool, you need the integration ID. Common integration IDs include:
- \`i:integration-management\` - For integration management tools (INTEGRATIONS_LIST, INTEGRATIONS_GET, etc.)
- \`i:databases-management\` - For database management tools
- \`i:agents-management\` - For agent management tools
- \`i:workflows-management\` - For workflow management tools
- Other integration IDs - Get them from INTEGRATIONS_LIST tool

### Usage Examples

**Call a tool without parameters:**
\`\`\`jsx
// Call INTEGRATIONS_LIST to get all integrations
const integrations = await callTool({
  integrationId: 'i:integration-management',
  toolName: 'INTEGRATIONS_LIST',
  input: {}  // Empty object when tool requires no parameters
});
\`\`\`

**Call a tool with parameters:**
\`\`\`jsx
// Call INTEGRATIONS_GET with an integration ID
const integration = await callTool({
  integrationId: 'i:integration-management',
  toolName: 'INTEGRATIONS_GET',
  input: {
    id: 'i:some-integration'
  }
});

// Call a tool from a specific integration
const result = await callTool({
  integrationId: 'i:some-integration-id',
  toolName: 'TOOL_NAME',
  input: {
    userId: '123',
    includeProfile: true
  }
});
\`\`\`

**Use empty object when no parameters needed:**
\`\`\`jsx
// input is required - use {} when the tool needs no parameters
const data = await callTool({
  integrationId: 'i:integration-management',
  toolName: 'INTEGRATIONS_LIST',
  input: {}
});
\`\`\`

**With error handling:**
\`\`\`jsx
try {
  const result = await callTool({
    integrationId: 'i:integration-management',
    toolName: 'INTEGRATIONS_LIST',
    input: {}
  });
  console.log('Success:', result);
} catch (error) {
  console.error('Tool call failed:', error.message);
}
\`\`\`

### Important Notes

- \`integrationId\`, \`toolName\`, and \`input\` are **required** parameters
- \`input\` must be an object (not an array) - use \`{}\` if the tool needs no parameters
- The function always calls INTEGRATIONS_CALL_TOOL internally - you don't need to specify this
- The function returns a Promise that resolves with the tool's result
- Errors are thrown if parameters are invalid or if the API call fails
- Use INTEGRATIONS_LIST to discover available integrations and their IDs

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

**CRITICAL: Always include comprehensive console logs for debugging.** Views run in isolated iframes, making debugging difficult without proper logging. Add console.log statements for:

1. **Initial render & props** - Log all props received when component mounts:
   \`\`\`jsx
   export const App = (props) => {
     console.log('[ViewName] Component mounted with props:', props);
     // ... component code
   };
   \`\`\`

2. **Tool calls** - Log before calling tools, after receiving results, and on errors:
   \`\`\`jsx
   const fetchData = async () => {
     console.log('[ViewName] Calling tool:', { integrationId: 'i:...', toolName: 'TOOL_NAME' });
     try {
       const result = await callTool({ integrationId: 'i:...', toolName: 'TOOL_NAME', input: {} });
       console.log('[ViewName] Tool result:', result);
       setData(result);
     } catch (error) {
       console.error('[ViewName] Tool call failed:', error);
     }
   };
   \`\`\`

3. **State changes** - Log important state updates:
   \`\`\`jsx
   const handleSubmit = (data) => {
     console.log('[ViewName] Form submitted with data:', data);
     setFormData(data);
   };
   \`\`\`

4. **Data transformations** - Log before/after processing data:
   \`\`\`jsx
   useEffect(() => {
     if (rawData) {
       console.log('[ViewName] Processing raw data:', rawData);
       const processed = transformData(rawData);
       console.log('[ViewName] Processed data:', processed);
       setProcessedData(processed);
     }
   }, [rawData]);
   \`\`\`

5. **Error conditions** - Always log errors with context:
   \`\`\`jsx
   if (!requiredProp) {
     console.error('[ViewName] Missing required prop:', 'requiredProp');
     return <div>Error: Missing required data</div>;
   }
   \`\`\`

**Log naming convention:** Prefix all logs with \`[ViewName]\` for easy filtering in browser console.
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

1. **Import hooks** - Always import React hooks you need: \`import { useState, useEffect } from 'react'\`
2. **Define App component** - Always define \`export const App = (props) => { ... }\`
3. **Access props data** - Use props to access any input data passed to the view (e.g., from workflow steps)
4. **Define inputSchema** - When your view expects specific props, define an inputSchema to document the data contract
5. **Use Tailwind classes** - Leverage Tailwind CSS for styling instead of custom CSS
6. **Handle loading states** - Show feedback when calling tools
7. **Error handling** - Use try/catch when calling tools
8. **Provide defaults** - Handle missing or undefined props gracefully with default values
9. **Clear naming** - Make view titles descriptive and searchable
10. **Add descriptions** - Help others understand the view's purpose
11. **Tag appropriately** - Use tags for easier discovery and organization
12. **Keep it simple** - Focus on the component logic, not boilerplate
13. **Add console logs** - ALWAYS include comprehensive logging for debugging (see Debugging section above)
14. **Use theme tokens** - ALWAYS use CSS custom properties (e.g., \`var(--primary)\`) instead of hardcoded colors for theme consistency
15. **Semantic token usage** - Use \`--destructive\` for delete buttons, \`--success\` for confirmations, \`--warning\` for caution, \`--muted\` for disabled states
16. **Leverage Basecoat UI** - Use Basecoat UI patterns (https://basecoatui.com/) for components since React shadcn/ui won't work in browser-only views

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
          const data = await callTool({
            integrationId: 'i:integration-management',
            toolName: 'GET_METRICS',
            input: {}
          });
          console.log('[Dashboard] Metrics loaded:', data);
          setMetrics(data);
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
      const res = await callTool({
        integrationId: 'i:integration-management',
        toolName: 'SUBMIT_FORM',
        input: formData
      });
      console.log('[InteractiveForm] Form submission result:', res);
      setResult(res);
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

1. **Preserve imports** - Ensure necessary React hooks are imported from 'react'
2. **Preserve App component** - Always keep the \`export const App = (props) => { ... }\` definition
3. **Handle props** - Ensure the component properly receives and uses props if input data is needed
4. **Update incrementally** - Make focused changes rather than rewriting everything
5. **Test changes** - Verify the component renders correctly after updates
6. **Use Tailwind classes** - Leverage Tailwind CSS for styling
7. **Manage tags thoughtfully** - Add relevant tags, remove outdated ones
8. **Add/preserve console logs** - ALWAYS ensure console logs are present for debugging. If updating a view without logs, add them. If logs exist, preserve them. Log props, tool calls, state changes, and errors with \`[ViewName]\` prefix

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
- Integrate tool calls with \`callTool({ integrationId: 'i:integration-id', toolName: 'TOOL_NAME', input: {} })\`
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

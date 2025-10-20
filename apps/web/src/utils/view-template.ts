/**
 * View HTML Template Generator (Frontend)
 *
 * Generates complete HTML from React component code for iframe rendering
 */

/**
 * Default import map for React 19.2.0
 */
const DEFAULT_IMPORT_MAP: Record<string, string> = {
  react: "https://esm.sh/react@19.2.0",
  "react/": "https://esm.sh/react@19.2.0/",
  "react-dom": "https://esm.sh/react-dom@19.2.0",
  "react-dom/client": "https://esm.sh/react-dom@19.2.0/client",
};

/**
 * Escapes closing script tags in user code to prevent premature script tag closure
 * @param code - The user code that may contain closing script tags
 * @returns Escaped code safe for embedding in <script type="text/template">
 */
function escapeScriptTags(code: string): string {
  // Replace </script> with <\/script> to prevent premature closing
  // Case-insensitive to catch </SCRIPT>, </Script>, etc.
  return code.replace(/<\/script>/gi, "<\\/script>");
}

/**
 * Generates complete HTML document from React component code
 *
 * @param code - The React component code (must define `export const App = () => {}`)
 * @param apiBase - The API base URL for tool calls (e.g., 'http://localhost:3001' or 'https://api.decocms.com')
 * @param workspace - The organization/workspace name (from route params)
 * @param project - The project name (from route params)
 * @param importmap - Optional custom import map (defaults to React 19.2.0 imports)
 * @returns Complete HTML document ready for iframe srcDoc
 */
export function generateViewHTML(
  code: string,
  apiBase: string,
  workspace: string,
  project: string,
  importmap?: Record<string, string>,
): string {
  const ws = workspace;
  const proj = project;

  // Escape closing script tags in user code to prevent HTML parsing issues
  const escapedCode = escapeScriptTags(code);

  // Merge custom import map with defaults
  const finalImportMap = {
    ...DEFAULT_IMPORT_MAP,
    ...importmap,
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DECO View</title>
  
  <!-- Import Maps for Module Resolution -->
  <script type="importmap">
${JSON.stringify({ imports: finalImportMap }, null, 4)}
  </script>
  
  <!-- Tailwind CSS 4 via PlayCDN -->
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
  
  <!-- Babel Standalone for JSX transformation -->
  <script src="https://unpkg.com/@babel/standalone@7.26.7/babel.min.js"></script>
  
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    }
    
    #root {
      width: 100%;
      min-height: 100vh;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  
  <script>
    /**
     * Global tool calling function
     * 
     * Calls a tool from the tools-management module
     * 
     * @param {Object} params - Tool call parameters
     * @param {string} params.toolName - Name of the tool to call (required)
     * @param {Object} params.input - Input parameters for the tool (required, can be empty object)
     * @returns {Promise<any>} Tool execution result
     * 
     * @example
     * const result = await callTool({
     *   toolName: 'INTEGRATIONS_LIST',
     *   input: {}
     * });
     */
    window.callTool = async function(params) {
      // Validate params structure
      if (!params || typeof params !== 'object') {
        throw new Error(
          'callTool Error: Expected an object parameter.\\n\\n' +
          'Usage:\\n' +
          '  await callTool({\\n' +
          '    toolName: "TOOL_NAME",  // Required: string\\n' +
          '    input: { }              // Required: object (can be empty)\\n' +
          '  });\\n\\n' +
          'Example:\\n' +
          '  const result = await callTool({\\n' +
          '    toolName: "INTEGRATIONS_LIST",\\n' +
          '    input: {}\\n' +
          '  });'
        );
      }

      const { toolName, input } = params;

      // Validate toolName
      if (!toolName || typeof toolName !== 'string') {
        throw new Error(
          'callTool Error: "toolName" is required and must be a string.\\n\\n' +
          'Current value: ' + JSON.stringify(toolName) + '\\n\\n' +
          'Usage:\\n' +
          '  await callTool({\\n' +
          '    toolName: "TOOL_NAME",  // Regular tool name or resource URI\\n' +
          '    input: { }              // Required: object\\n' +
          '  });\\n\\n' +
          'Examples:\\n' +
          '  - Regular tool: "INTEGRATIONS_LIST"\\n' +
          '  - Resource tool: "rsc://tools-management/tool/TOOL_SEARCH"\\n\\n' +
          'Both types are called the same way.'
        );
      }

      // Validate input
      if (input === undefined || input === null || typeof input !== 'object' || Array.isArray(input)) {
        throw new Error(
          'callTool Error: "input" is required and must be an object (not an array).\\n\\n' +
          'Current value: ' + JSON.stringify(input) + '\\n\\n' +
          'Usage:\\n' +
          '  await callTool({\\n' +
          '    toolName: "' + toolName + '",\\n' +
          '    input: { }  // Required: object (can be empty)\\n' +
          '  });\\n\\n' +
          'If the tool requires no parameters, pass an empty object: input: {}'
        );
      }

      try {
        // Call tool endpoint directly (works for both regular and resource tools)
        const response = await fetch(
          \`${apiBase}/${ws}/${proj}/tools/call/\${toolName}\`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(input),
          }
        );
        
        if (!response.ok) {
          throw new Error(\`HTTP error! status: \${response.status}\`);
        }
        
        const data = await response.json();
        return data?.data || data;
      } catch (error) {
        console.error('Tool call error:', error);
        throw error;
      }
    };
  </script>
  
  <!-- User's React component - visible for debugging -->
  <script type="text/template" id="user-code">
${escapedCode}
  </script>
  
  <script type="module">
    import { createElement } from 'react';
    import { createRoot } from 'react-dom/client';
    
    // Error display helper
    const showError = (error) => {
      console.error('View rendering error:', error);
      const userCode = document.getElementById('user-code')?.textContent || 'Code not available';
      document.getElementById('root').innerHTML = \`
        <div style="padding: 20px; color: #dc2626; font-family: monospace;">
          <h2>View Rendering Error</h2>
          <pre style="background: #fee; padding: 10px; border-radius: 4px; overflow: auto;"><code>\${error.message}</code></pre>
          <details style="margin-top: 10px;">
            <summary style="cursor: pointer; color: #2563eb;">View Source Code</summary>
            <pre style="background: #f3f4f6; padding: 10px; border-radius: 4px; overflow: auto; margin-top: 10px;"><code>\${userCode}</code></pre>
          </details>
        </div>
      \`;
    };
    
    try {
      // Get the user's code from the template
      const userCode = document.getElementById('user-code').textContent;
      
      // Transform with Babel using automatic JSX runtime
      const transformedCode = Babel.transform(userCode, {
        presets: [['react', { runtime: 'automatic', importSource: 'react' }]],
        filename: 'view.jsx',
      }).code;

      // Create a blob URL from the transformed code
      const blob = new Blob([transformedCode], { type: 'text/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      
      // Dynamically import the module from the blob URL
      const module = await import(blobUrl);
      const App = module.App || module.default;
      
      if (!App) {
        throw new Error('App component not found. Please define: export const App = () => { ... }');
      }
      
      createRoot(document.getElementById('root'))
        .render(createElement(App, {}, null));
      
      // Clean up the blob URL after import
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      showError(error);
    }
  </script>
</body>
</html>`;
}

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
 * Creates the View SDK with tool calling and AI fixing capabilities
 * This function will be stringified and injected into the iframe
 *
 * @param apiBase - API base URL
 * @param ws - Workspace/organization name
 * @param proj - Project name
 */
function createSDK(apiBase: string, ws: string, proj: string) {
  // Global SDK functions
  // @ts-ignore - This function will be stringified and run in the iframe context
  window.callTool = async function (params: {
    toolName: string;
    input: Record<string, unknown>;
  }) {
    if (!params || typeof params !== "object") {
      throw new Error(
        "callTool Error: Expected an object parameter.\n\n" +
          "Usage:\n" +
          "  await callTool({\n" +
          '    toolName: "TOOL_NAME",\n' +
          "    input: { }\n" +
          "  });",
      );
    }

    const { toolName, input } = params;

    if (!toolName || typeof toolName !== "string") {
      throw new Error(
        'callTool Error: "toolName" is required and must be a string.',
      );
    }

    if (
      input === undefined ||
      input === null ||
      typeof input !== "object" ||
      Array.isArray(input)
    ) {
      throw new Error(
        'callTool Error: "input" is required and must be an object.',
      );
    }

    try {
      const response = await fetch(
        apiBase + "/" + ws + "/" + proj + "/tools/call/" + toolName,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(input),
        },
      );

      if (!response.ok) {
        throw new Error("HTTP error! status: " + response.status);
      }

      const data = (await response.json()) as { data?: unknown } | unknown;
      return (data as { data?: unknown })?.data || data;
    } catch (error) {
      console.error("Tool call error:", error);
      throw error;
    }
  };

  // @ts-ignore - This function will be stringified and run in the iframe context
  window.fixWithAI = function (
    message: string,
    context?: Record<string, unknown>,
  ) {
    if (typeof message !== "string") {
      console.error("fixWithAI: message must be a string");
      return;
    }

    window.parent.postMessage(
      {
        type: "FIX_WITH_AI",
        payload: {
          message: message,
          context: context || {},
          timestamp: new Date().toISOString(),
        },
      },
      "*",
    );
  };

  // Catch runtime errors using window.onerror
  window.onerror = function (message, source, lineno, colno, error) {
    const errorData = {
      message: error?.message || String(message),
      timestamp: new Date().toISOString(),
      source: source,
      line: lineno,
      column: colno,
      stack: error?.stack,
      name: error?.name || "Error",
    };

    // Notify parent window
    window.top?.postMessage(
      {
        type: "RUNTIME_ERROR",
        payload: errorData,
      },
      "*",
    );

    // Return false to allow default error handling
    return false;
  };

  // Catch errors on elements (e.g., image load failures, script errors)
  window.addEventListener("error", function (event) {
    // Ignore if it's already handled by window.onerror
    if (event.error) {
      return;
    }

    const errorData = {
      message: event.message || "Resource failed to load",
      timestamp: new Date().toISOString(),
      target: event.target?.toString() || "Unknown",
      type: event.type,
    };

    // Notify parent window
    window.top?.postMessage(
      {
        type: "RESOURCE_ERROR",
        payload: errorData,
      },
      "*",
    );
  });

  // Catch unhandled promise rejections
  window.addEventListener("unhandledrejection", function (event) {
    const error = event.reason;
    const errorData = {
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : "UnhandledRejection",
      reason: error,
    };

    // Notify parent window
    window.top?.postMessage(
      {
        type: "UNHANDLED_REJECTION",
        payload: errorData,
      },
      "*",
    );

    // Prevent default console error
    event.preventDefault();
  });
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
    ...(importmap || {}),
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
  
  <!-- View SDK -->
  <script>
    (${createSDK.toString()})('${apiBase}', '${ws}', '${proj}');
  </script>
  
  <!-- User's React component - visible for debugging -->
  <script type="text/template" id="user-code">
${escapedCode}
  </script>
  
  <script type="module">
    import { createElement } from 'react';
    import { createRoot } from 'react-dom/client';
    
    // Error display helper for module loading errors
    const showError = (error) => {
      console.error('View loading error:', error);
      const userCode = document.getElementById('user-code')?.textContent || 'Code not available';
      
      const errorHtml = '<div class="p-5 text-red-600 font-sans max-w-3xl mx-auto">' +
        '<div class="bg-red-50 border-2 border-red-600 rounded-lg p-4 mb-4">' +
        '<h2 class="m-0 mb-2 text-red-900 text-lg font-bold">⚠️ View Loading Error</h2>' +
        '<p class="m-0 text-red-900 font-mono text-sm">' + error.message + '</p>' +
        '</div>' +
        '<details class="mb-4">' +
        '<summary class="cursor-pointer font-bold mb-2 text-sm">Error Details</summary>' +
        '<pre class="bg-gray-100 p-3 rounded overflow-auto text-xs"><code>' + (error.stack || 'No stack trace available') + '</code></pre>' +
        '</details>' +
        '<details class="mb-4">' +
        '<summary class="cursor-pointer font-bold mb-2 text-sm">View Source Code</summary>' +
        '<pre class="bg-gray-100 p-3 rounded overflow-auto text-xs"><code>' + userCode + '</code></pre>' +
        '</details>' +
        '<button ' +
        'onclick="window.fixWithAI(' + 
        "'The view failed to load with this error:\\\\n\\\\n' + " + JSON.stringify(error.message) + ", { errorType: 'loading_error' })" +
        '" ' +
        'class="bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-none px-6 py-3 rounded-md text-sm font-semibold cursor-pointer shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg mt-4"' +
        '>' +
        '✨ Fix with AI' +
        '</button>' +
        '</div>';
      
      document.getElementById('root').innerHTML = errorHtml;
    };
    
    try {
      // Compile user's code
      const userCode = document.getElementById('user-code').textContent;
      const transformedCode = Babel.transform(userCode, {
        presets: [['react', { runtime: 'automatic', importSource: 'react' }]],
        filename: 'view.jsx',
      }).code;

      const blob = new Blob([transformedCode], { type: 'text/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      const module = await import(blobUrl);
      const App = module.App || module.default;
      URL.revokeObjectURL(blobUrl);
      
      if (!App) {
        throw new Error('App component not found. Please define: export const App = () => { ... }');
      }
      
      // Render App wrapped in ErrorBoundary
      createRoot(document.getElementById('root')).render(
        createElement(App, {}, null)
      );
    } catch (error) {
      showError(error);
    }
  </script>
</body>
</html>`;
}

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
 * Creates the View SDK with tool calling and error tracking capabilities
 * This function will be stringified and injected into the iframe
 *
 * @param apiBase - API base URL
 * @param ws - Workspace/organization name
 * @param proj - Project name
 * @param trustedOrigin - The trusted origin for postMessage validation
 */
function createSDK(
  apiBase: string,
  ws: string,
  proj: string,
  trustedOrigin: string,
) {
  // Initialize view data (will be populated by parent window via postMessage)
  // @ts-expect-error - This function will be stringified and run in the iframe context
  window.viewData = {};

  // Compute expected origin from document.referrer with strict validation
  const expectedOrigin = (() => {
    try {
      if (document.referrer) {
        const referrerOrigin = new URL(document.referrer).origin;
        // Verify that referrer matches the trusted origin
        if (referrerOrigin === trustedOrigin) {
          return referrerOrigin;
        }
        console.warn(
          "View Security Warning: document.referrer origin does not match trustedOrigin. " +
            "Referrer: " +
            referrerOrigin +
            ", Expected: " +
            trustedOrigin,
        );
      }
    } catch (e) {
      console.warn("Failed to parse document.referrer:", e);
    }

    // Fallback to configured trusted origin when referrer is absent or mismatched
    // This is safer than using window.location.origin which could be attacker-controlled
    console.info(
      "Using configured trustedOrigin for postMessage validation: " +
        trustedOrigin,
    );
    return trustedOrigin;
  })();

  // Listen for data from parent window with strict origin and source validation
  window.addEventListener("message", function (event) {
    // Validate message type, source, and origin before processing
    if (
      event.data &&
      event.data.type === "VIEW_DATA" &&
      event.source === window.parent &&
      event.origin === expectedOrigin
    ) {
      // @ts-expect-error - This function will be stringified and run in the iframe context
      window.viewData = event.data.payload;
      // Dispatch custom event so React can re-render with new props
      window.dispatchEvent(
        new CustomEvent("viewDataUpdated", { detail: event.data.payload }),
      );
    } else if (event.data && event.data.type === "VIEW_DATA") {
      // Log rejected messages for debugging (without exposing sensitive data)
      console.warn(
        "View Security: Rejected VIEW_DATA message. " +
          "Origin: " +
          event.origin +
          " (expected: " +
          expectedOrigin +
          "), " +
          "Source valid: " +
          (event.source === window.parent),
      );
    }
    // Silently ignore other message types
  });

  // Global SDK functions
  // @ts-ignore - This function will be stringified and run in the iframe context
  window.callTool = async function (params: {
    integrationId: string;
    toolName: string;
    input: Record<string, unknown>;
  }) {
    if (!params || typeof params !== "object") {
      throw new Error(
        "callTool Error: Expected an object parameter.\n\n" +
          "Usage:\n" +
          "  await callTool({\n" +
          '    integrationId: "integration-id",\n' +
          '    toolName: "TOOL_NAME",\n' +
          "    input: { }\n" +
          "  });",
      );
    }

    const { integrationId, toolName, input } = params;

    if (!integrationId || typeof integrationId !== "string") {
      console.warn(
        'callTool Warning: "integrationId" is required and must be a string.',
      );
      return undefined as unknown;
    }

    if (!toolName || typeof toolName !== "string") {
      throw new Error(
        'callTool Error: "toolName" is required and must be a string.',
      );
    }

    if (input === undefined || input === null) {
      throw new Error(
        'callTool Error: "input" is required and must be an object.',
      );
    }

    if (typeof input !== "object" || Array.isArray(input)) {
      throw new Error(
        'callTool Error: "input" must be an object (not an array).',
      );
    }

    try {
      // Call INTEGRATIONS_CALL_TOOL with the proper structure
      const response = await fetch(
        apiBase + "/" + ws + "/" + proj + "/tools/call/INTEGRATIONS_CALL_TOOL",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            id: integrationId,
            params: { name: toolName, arguments: input },
          }),
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

  // Intercept console methods to send logs to parent window
  const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };

  console.log = function(...args) {
    originalConsole.log.apply(console, args);
    window.top?.postMessage({
      type: "CONSOLE_LOG",
      payload: {
        level: "log",
        message: args.map(arg => 
          typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(" "),
        timestamp: new Date().toISOString(),
      }
    }, "*");
  };

  console.info = function(...args) {
    originalConsole.info.apply(console, args);
    window.top?.postMessage({
      type: "CONSOLE_LOG",
      payload: {
        level: "info",
        message: args.map(arg => 
          typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(" "),
        timestamp: new Date().toISOString(),
      }
    }, "*");
  };

  console.warn = function(...args) {
    originalConsole.warn.apply(console, args);
    window.top?.postMessage({
      type: "CONSOLE_LOG",
      payload: {
        level: "warn",
        message: args.map(arg => 
          typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(" "),
        timestamp: new Date().toISOString(),
      }
    }, "*");
  };

  console.error = function(...args) {
    originalConsole.error.apply(console, args);
    window.top?.postMessage({
      type: "CONSOLE_LOG",
      payload: {
        level: "error",
        message: args.map(arg => 
          typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(" "),
        timestamp: new Date().toISOString(),
      }
    }, "*");
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
 * @param code - The React component code (must define `export const App = (props) => {}`).
 *               The App component will receive input data as props when passed from the parent window.
 * @param apiBase - The API base URL for tool calls (e.g., 'http://localhost:3001' or 'https://api.decocms.com')
 * @param workspace - The organization/workspace name (from route params)
 * @param project - The project name (from route params)
 * @param trustedOrigin - The trusted origin for postMessage validation (typically the admin app's origin)
 * @param importmap - Optional custom import map (defaults to React 19.2.0 imports)
 * @returns Complete HTML document ready for iframe srcDoc
 */
export function generateViewHTML(
  code: string,
  apiBase: string,
  workspace: string,
  project: string,
  trustedOrigin: string,
  importmap?: Record<string, string>,
): string {
  const ws = workspace;
  const proj = project;

  // Validate trustedOrigin parameter
  if (!trustedOrigin || typeof trustedOrigin !== "string") {
    throw new Error(
      "generateViewHTML: trustedOrigin is required and must be a non-empty string",
    );
  }

  // Validate that trustedOrigin is a valid origin (protocol + host)
  try {
    const url = new URL(trustedOrigin);
    // Ensure it's just the origin (no path, query, or hash)
    if (url.origin !== trustedOrigin) {
      throw new Error(
        `generateViewHTML: trustedOrigin must be a valid origin (protocol + host only). Got: ${trustedOrigin}`,
      );
    }
  } catch (error) {
    throw new Error(
      `generateViewHTML: Invalid trustedOrigin URL: ${trustedOrigin}. ${error instanceof Error ? error.message : ""}`,
    );
  }

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
  <title>DECO View  </title>

  <!-- View SDK -->
  <script>
    (${createSDK.toString()})('${apiBase}', '${ws}', '${proj}', '${trustedOrigin}');
  </script>
  
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
        '</div>';
      
      document.getElementById('root').innerHTML = errorHtml;
    };
    
    // Global root instance for re-rendering
    let rootInstance = null;
    
    // Render function that can be called multiple times
    const renderApp = (App) => {
      if (!rootInstance) {
        rootInstance = createRoot(document.getElementById('root'));
      }
      // Pass window.viewData as props to the App component
      rootInstance.render(
        createElement(App, window.viewData || {}, null)
      );
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
      
      // Initial render with current viewData
      renderApp(App);
      
      // Re-render when viewData updates
      window.addEventListener('viewDataUpdated', () => {
        renderApp(App);
      });
    } catch (error) {
      showError(error);
    }
  </script>
</body>
</html>`;
}

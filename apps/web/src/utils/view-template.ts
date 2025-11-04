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

  // Safe stringify helper that handles circular references
  const safeStringify = (obj: unknown): string => {
    try {
      // Track seen objects to detect circular references
      const seen = new WeakSet();
      return JSON.stringify(
        obj,
        (key, value) => {
          if (typeof value === "object" && value !== null) {
            if (seen.has(value)) {
              return "[Circular]";
            }
            seen.add(value);
          }
          return value;
        },
        2,
      );
    } catch {
      // Fallback for non-serializable objects
      try {
        return String(obj);
      } catch {
        return "[Unserializable]";
      }
    }
  };

  // Intercept console methods to send logs to parent window
  const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };

  console.log = function (...args) {
    // Always call original console first
    originalConsole.log.apply(console, args);

    // Safely serialize and send to parent
    try {
      window.top?.postMessage(
        {
          type: "CONSOLE_LOG",
          payload: {
            level: "log",
            message: args
              .map((arg) =>
                typeof arg === "object" ? safeStringify(arg) : String(arg),
              )
              .join(" "),
            timestamp: new Date().toISOString(),
          },
        },
        trustedOrigin,
      );
    } catch (error) {
      // Silently fail postMessage - original console call already happened
      originalConsole.error("Failed to send console log to parent:", error);
    }
  };

  console.info = function (...args) {
    // Always call original console first
    originalConsole.info.apply(console, args);

    // Safely serialize and send to parent
    try {
      window.top?.postMessage(
        {
          type: "CONSOLE_LOG",
          payload: {
            level: "info",
            message: args
              .map((arg) =>
                typeof arg === "object" ? safeStringify(arg) : String(arg),
              )
              .join(" "),
            timestamp: new Date().toISOString(),
          },
        },
        trustedOrigin,
      );
    } catch (error) {
      // Silently fail postMessage - original console call already happened
      originalConsole.error("Failed to send console info to parent:", error);
    }
  };

  console.warn = function (...args) {
    // Always call original console first
    originalConsole.warn.apply(console, args);

    // Safely serialize and send to parent
    try {
      window.top?.postMessage(
        {
          type: "CONSOLE_LOG",
          payload: {
            level: "warn",
            message: args
              .map((arg) =>
                typeof arg === "object" ? safeStringify(arg) : String(arg),
              )
              .join(" "),
            timestamp: new Date().toISOString(),
          },
        },
        trustedOrigin,
      );
    } catch (error) {
      // Silently fail postMessage - original console call already happened
      originalConsole.error("Failed to send console warning to parent:", error);
    }
  };

  console.error = function (...args) {
    // Always call original console first
    originalConsole.error.apply(console, args);

    // Safely serialize and send to parent
    try {
      window.top?.postMessage(
        {
          type: "CONSOLE_LOG",
          payload: {
            level: "error",
            message: args
              .map((arg) =>
                typeof arg === "object" ? safeStringify(arg) : String(arg),
              )
              .join(" "),
            timestamp: new Date().toISOString(),
          },
        },
        trustedOrigin,
      );
    } catch (error) {
      // Silently fail postMessage - original console call already happened
      originalConsole.error("Failed to send console error to parent:", error);
    }
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
      trustedOrigin,
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
      trustedOrigin,
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
      trustedOrigin,
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
 * @param themeVariables - Optional theme CSS custom properties to inject into the view
 * @returns Complete HTML document ready for iframe srcDoc
 */
export function generateViewHTML(
  code: string,
  apiBase: string,
  workspace: string,
  project: string,
  trustedOrigin: string,
  importmap?: Record<string, string>,
  themeVariables?: Record<string, string>,
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

  // Generate CSS custom properties from theme variables
  const themeVariablesCSS = themeVariables
    ? Object.entries(themeVariables)
        .map(([key, value]) => `    ${key}: ${value};`)
        .join("\n")
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DECO View </title>

  <!-- Visual CMS for Text Editing -->
  <script>
    (function() {
      'use strict';
      
      // CMS State
      let cmsEnabled = false;
      let cmsData = {};
      let editingElement = null;
      let editingOriginalText = '';
      
      // Expose editing flag globally so React can check it
      window.isCMSEditing = false;
      
      // Initialize CMS from viewData if available
      function initCMS() {
        if (window.viewData && window.viewData._cms) {
          cmsData = window.viewData._cms || {};
          // Apply saved data immediately if available
          if (Object.keys(cmsData).length > 0) {
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', function() {
                setTimeout(applyCMSData, 200);
              });
            } else {
              setTimeout(applyCMSData, 200);
            }
          }
        }
      }
      
      // Toggle CMS mode
      function toggleCMS() {
        cmsEnabled = !cmsEnabled;
        updateCMSMode();
        if (cmsEnabled) {
          enableEditing();
        } else {
          disableEditing();
        }
      }
      
      // Set CMS enabled state
      function setCMSEnabled(enabled) {
        if (cmsEnabled === enabled) return;
        cmsEnabled = enabled;
        updateCMSMode();
        if (cmsEnabled) {
          enableEditing();
        } else {
          disableEditing();
        }
      }
      
      // Update UI based on CMS mode
      function updateCMSMode() {
        const root = document.documentElement;
        if (cmsEnabled) {
          root.classList.add('cms-mode');
          root.setAttribute('data-cms-enabled', 'true');
        } else {
          root.classList.remove('cms-mode');
          root.removeAttribute('data-cms-enabled');
        }
      }
      
      // Enable editing on text elements
      function enableEditing() {
        // Clean up existing observer if any
        if (window.cmsObserver) {
          window.cmsObserver.disconnect();
        }
        
        // Use MutationObserver to handle React-rendered content
        const observer = new MutationObserver(function(mutations) {
          if (cmsEnabled) {
            // Re-scan for new elements when DOM changes
            const textElements = findTextElements();
            textElements.forEach(setupElementForEditing);
          }
        });
        
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
        
        // Store observer for cleanup
        window.cmsObserver = observer;
        
        // Initial scan
        const textElements = findTextElements();
        textElements.forEach(setupElementForEditing);
      }
      
      // Setup element for editing
      function setupElementForEditing(element) {
        if (!element.hasAttribute('data-cms-editable')) {
          // Generate and store ID if not present
          if (!element.id && !element.hasAttribute('data-cms-id')) {
            const elementId = getElementId(element);
            element.setAttribute('data-cms-id', elementId);
          }
          
          element.setAttribute('data-cms-editable', 'true');
          element.classList.add('cms-editable');
          
          // Add hover effect
          element.addEventListener('mouseenter', handleMouseEnter);
          element.addEventListener('mouseleave', handleMouseLeave);
          element.addEventListener('click', handleClick);
        }
      }
      
      // Disable editing
      function disableEditing() {
        // Stop observer
        if (window.cmsObserver) {
          window.cmsObserver.disconnect();
          window.cmsObserver = null;
        }
        
        const editableElements = document.querySelectorAll('[data-cms-editable]');
        editableElements.forEach(element => {
          element.removeAttribute('data-cms-editable');
          element.classList.remove('cms-editable', 'cms-hover');
          element.removeEventListener('mouseenter', handleMouseEnter);
          element.removeEventListener('mouseleave', handleMouseLeave);
          element.removeEventListener('click', handleClick);
        });
        
        if (editingElement) {
          cancelEditing();
        }
      }
      
      // Find all elements that contain text
      function findTextElements() {
        const elements = [];
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_ELEMENT,
          {
            acceptNode: function(node) {
              // Skip script, style, and other non-editable elements
              if (node.tagName === 'SCRIPT' || 
                  node.tagName === 'STYLE' || 
                  node.tagName === 'NOSCRIPT' ||
                  node.hasAttribute('data-cms-ignore')) {
                return NodeFilter.FILTER_REJECT;
              }
              
              // Only include elements with text content
              const text = node.textContent?.trim();
              if (text && text.length > 0) {
                // Skip if parent is already editable
                if (node.parentElement?.hasAttribute('data-cms-editable')) {
                  return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
              }
              return NodeFilter.FILTER_SKIP;
            }
          }
        );
        
        let node;
        while (node = walker.nextNode()) {
          elements.push(node);
        }
        
        return elements;
      }
      
      // Generate unique ID for element
      function getElementId(element) {
        // Use existing ID or data-cms-id if available
        if (element.id) {
          return element.id;
        }
        if (element.hasAttribute('data-cms-id')) {
          return element.getAttribute('data-cms-id');
        }
        
        // Generate ID based on element position in DOM tree
        const path = [];
        let current = element;
        while (current && current !== document.body) {
          const parent = current.parentElement;
          if (parent) {
            const siblings = Array.from(parent.children).filter(
              c => c.tagName === current.tagName
            );
            const index = siblings.indexOf(current);
            path.unshift(current.tagName.toLowerCase() + ':' + index);
          }
          current = parent;
        }
        return path.join(' > ') || 'element-' + Date.now() + '-' + Math.random().toString(36).slice(2, 11);
      }
      
      // Handle mouse enter
      function handleMouseEnter(e) {
        if (!cmsEnabled) return;
        e.stopPropagation();
        e.currentTarget.classList.add('cms-hover');
      }
      
      // Handle mouse leave
      function handleMouseLeave(e) {
        if (!cmsEnabled) return;
        e.stopPropagation();
        e.currentTarget.classList.remove('cms-hover');
      }
      
      // Handle click to edit
      function handleClick(e) {
        if (!cmsEnabled) return;
        e.preventDefault();
        e.stopPropagation();
        
        const element = e.currentTarget;
        startEditing(element);
      }
      
      // Start editing an element
      function startEditing(element) {
        if (editingElement) {
          cancelEditing();
        }
        
        editingElement = element;
        editingOriginalText = element.textContent || '';
        window.isCMSEditing = true; // Set flag to prevent re-renders
        
        // Make element contentEditable
        element.contentEditable = 'true';
        element.classList.add('cms-editing');
        element.setAttribute('data-cms-editing', 'true');
        
        // Focus and select all
        element.focus();
        const range = document.createRange();
        range.selectNodeContents(element);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        
        // Add save handlers
        element.addEventListener('blur', handleBlur);
        element.addEventListener('keydown', handleKeyDown);
      }
      
      // Handle blur (save)
      function handleBlur(e) {
        const element = e.currentTarget;
        const newText = element.textContent || '';
        
        if (newText !== editingOriginalText) {
          // Use saveEditWithoutDOMUpdate to prevent React re-render
          // The DOM is already updated by contentEditable, so we don't need to update it again
          saveEditWithoutDOMUpdate(element, editingOriginalText, newText);
        }
        
        finishEditing(element);
      }
      
      // Handle keydown
      function handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancelEditing();
        }
      }
      
      // Cancel editing
      function cancelEditing() {
        if (editingElement) {
          editingElement.textContent = editingOriginalText;
          finishEditing(editingElement);
          editingElement = null;
          editingOriginalText = '';
        }
      }
      
      // Finish editing
      function finishEditing(element) {
        element.contentEditable = 'false';
        element.classList.remove('cms-editing');
        element.removeAttribute('data-cms-editing');
        element.removeEventListener('blur', handleBlur);
        element.removeEventListener('keydown', handleKeyDown);
        
        // Clear flag after a small delay to allow any pending operations to complete
        setTimeout(function() {
          window.isCMSEditing = false;
        }, 100);
      }
      
      // Save edit (original version - kept for compatibility)
      function saveEdit(element, oldText, newText) {
        saveEditWithoutDOMUpdate(element, oldText, newText);
        // Apply saved text to element (but this is already done by contentEditable)
        element.textContent = newText;
      }
      
      // Save edit without updating DOM (prevents React re-render)
      function saveEditWithoutDOMUpdate(element, oldText, newText) {
        const elementId = getElementId(element);
        cmsData[elementId] = {
          text: newText,
          originalText: oldText,
          timestamp: new Date().toISOString()
        };
        
        // Don't update element.textContent here - it's already updated by contentEditable
        // This prevents React from detecting the change and re-rendering
        
        // Send update to parent window
        if (window.parent && window.parent.postMessage) {
          window.parent.postMessage(
            {
              type: 'CMS_UPDATE',
              payload: {
                elementId: elementId,
                text: newText,
                originalText: oldText,
                cmsData: cmsData
              }
            },
            '*'
          );
        }
      }
      
      // Apply saved CMS data to elements
      function applyCMSData() {
        if (Object.keys(cmsData).length === 0) {
          console.log('applyCMSData: No CMS data to apply');
          return;
        }
        
        console.log('applyCMSData: Applying CMS data:', cmsData);
        
        // Use a small delay to ensure React has rendered
        setTimeout(function() {
          let appliedCount = 0;
          Object.keys(cmsData).forEach(function(elementId) {
            const element = document.querySelector('[data-cms-id="' + elementId + '"]');
            if (!element) {
              // Try to find by path
              const parts = elementId.split(' > ');
              let found = document.body;
              for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                const [tag, index] = part.split(':');
                const children = Array.from(found.children).filter(function(c) {
                  return c.tagName.toLowerCase() === tag;
                });
                if (children[parseInt(index, 10)]) {
                  found = children[parseInt(index, 10)];
                } else {
                  found = null;
                  break;
                }
              }
              if (found) {
                found.setAttribute('data-cms-id', elementId);
                if (cmsData[elementId] && cmsData[elementId].text) {
                  console.log('Applying CMS data to element by path:', elementId, cmsData[elementId].text);
                  found.textContent = cmsData[elementId].text;
                  appliedCount++;
                }
              }
            } else {
              if (cmsData[elementId] && cmsData[elementId].text) {
                // Only update if different to avoid React re-render issues
                if (element.textContent !== cmsData[elementId].text) {
                  console.log('Applying CMS data to element by ID:', elementId, cmsData[elementId].text);
                  element.textContent = cmsData[elementId].text;
                  appliedCount++;
                }
              }
            }
          });
          
          console.log('applyCMSData: Applied', appliedCount, 'of', Object.keys(cmsData).length, 'elements');
          
          // If we couldn't apply data yet (React hasn't rendered), try again
          if (appliedCount === 0 && Object.keys(cmsData).length > 0) {
            console.log('applyCMSData: No elements found, retrying...');
            setTimeout(applyCMSData, 500);
          }
        }, 100);
      }
      
      // Listen for CMS messages from parent
      window.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'CMS_TOGGLE') {
          toggleCMS();
        } else if (event.data && event.data.type === 'CMS_SET_ENABLED') {
          setCMSEnabled(event.data.payload?.enabled === true);
        } else if (event.data && event.data.type === 'CMS_DATA') {
          console.log('CMS_DATA received in iframe:', event.data.payload);
          cmsData = event.data.payload || {};
          applyCMSData();
        }
      });
      
      // Listen for viewData updates
      window.addEventListener('viewDataUpdated', function(event) {
        console.log('viewDataUpdated event in iframe:', event.detail);
        if (event.detail && event.detail._cms) {
          console.log('CMS data found in viewDataUpdated:', event.detail._cms);
          const newCmsData = event.detail._cms;
          
          // Check if CMS data actually changed (compare JSON strings)
          const currentCmsDataStr = JSON.stringify(cmsData);
          const newCmsDataStr = JSON.stringify(newCmsData);
          
          if (currentCmsDataStr === newCmsDataStr) {
            console.log('CMS data unchanged, skipping re-render');
            return; // Don't re-render if data is the same
          }
          
          cmsData = newCmsData;
          // Wait for React to finish rendering before applying CMS data
          setTimeout(function() {
            applyCMSData();
            // Re-enable editing if it was enabled to catch new elements
            if (cmsEnabled) {
              enableEditing();
            }
          }, 300);
        } else {
          // Even if no CMS data, check if we should re-render
          // Only re-render if viewData actually changed (not just timestamp)
          const currentViewDataStr = JSON.stringify(window.viewData);
          const newViewDataStr = JSON.stringify(event.detail);
          
          if (currentViewDataStr === newViewDataStr) {
            console.log('ViewData unchanged, skipping re-render');
            return;
          }
        }
      });
      
      // Initialize CMS
      initCMS();
      
      // Expose CMS API globally
      window.viewCMS = {
        toggle: toggleCMS,
        enable: function() { if (!cmsEnabled) toggleCMS(); },
        disable: function() { if (cmsEnabled) toggleCMS(); },
        getData: function() { return cmsData; },
        isEnabled: function() { return cmsEnabled; }
      };
    })();
  </script>
  
  <style>
    /* CMS Styles */
    [data-cms-enabled="true"] [data-cms-editable] {
      position: relative;
      transition: all 0.2s ease;
    }
    
    [data-cms-enabled="true"] [data-cms-editable].cms-hover {
      outline: 2px dashed #3b82f6;
      outline-offset: 2px;
      background-color: rgba(59, 130, 246, 0.05);
      cursor: text;
    }
    
    [data-cms-enabled="true"] [data-cms-editable].cms-editing {
      outline: 2px solid #3b82f6;
      outline-offset: 2px;
      background-color: rgba(59, 130, 246, 0.1);
    }
    
    [data-cms-enabled="true"] [data-cms-editable]:hover::after {
      content: '✏️ Edit';
      position: absolute;
      top: -24px;
      left: 0;
      background: #3b82f6;
      color: white;
      padding: 2px 6px;
      font-size: 11px;
      border-radius: 3px;
      pointer-events: none;
      white-space: nowrap;
      z-index: 10000;
    }
  </style>

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
    :root {${themeVariablesCSS ? `\n${themeVariablesCSS}` : ""}
    }
    
    body {
      margin: 0;
      padding: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: var(--background, oklch(1 0 0));
      color: var(--foreground, oklch(0.2050 0 0));
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
      // But skip if we're currently editing with CMS (prevents re-render during CMS edits)
      // Also skip if viewData hasn't actually changed
      let previousViewDataStr = JSON.stringify(window.viewData || {});
      window.addEventListener('viewDataUpdated', (event) => {
        // Check if CMS is currently editing - if so, don't re-render
        if (window.isCMSEditing) {
          return;
        }
        
        // Check if viewData actually changed
        const newViewDataStr = JSON.stringify(event.detail || {});
        if (newViewDataStr === previousViewDataStr) {
          console.log('viewDataUpdated: No actual changes, skipping re-render');
          return;
        }
        
        previousViewDataStr = newViewDataStr;
        renderApp(App);
      });
    } catch (error) {
      showError(error);
    }
  </script>
</body>
</html>`;
}

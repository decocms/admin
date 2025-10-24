import { z } from "zod";

/**
 * View Definition Schema
 *
 * This schema defines the structure for views using Resources 2.0
 * Views are React components that are rendered in an iframe with a standardized template.
 *
 * Views can receive input data via props (e.g., from workflow steps, external sources, or direct calls).
 * The optional inputSchema defines the expected shape of this data using JSON Schema format.
 */
export const ViewDefinitionSchema = z.object({
  name: z.string().min(1).describe("The name/title of the view"),
  description: z.string().describe("A brief description of the view's purpose"),
  inputSchema: z
    .object({})
    .passthrough()
    .optional()
    .describe(
      "Optional JSON Schema (draft-07) defining the expected input data structure. " +
        "When provided, this schema documents what props the view expects to receive. " +
        "Useful for: 1) Documenting the view's data contract, 2) Type validation in workflows, " +
        "3) Auto-generating forms or input UIs. Example: { type: 'object', properties: { userId: { type: 'string' }, metrics: { type: 'array' } }, required: ['userId'] }",
    ),
  code: z
    .string()
    .default(`export const App = (props) => {
  // Props contain any input data passed to this view (e.g., from a workflow step output)
  // Access your data via: props.yourDataKey
  
  return (
    <div className="w-full min-h-screen h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="text-center max-w-2xl px-8 space-y-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-gray-900">
            Welcome to Your New View
          </h1>
          <p className="text-xl text-gray-600">
            Ready to build something amazing?
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-8 space-y-4">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-gray-800">
              🚀 Start Vibecoding
            </h2>
            <p className="text-gray-600">
              Just write in the chat what you need and watch your view come to life
            </p>
          </div>
          
          <div className="text-left space-y-3 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">💡 Try saying:</span>
            </p>
            <ul className="text-sm text-gray-600 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">→</span>
                <span>"Add a table to display my data"</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">→</span>
                <span>"Create a form with name and email fields"</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">→</span>
                <span>"Show a chart with monthly statistics"</span>
              </li>
            </ul>
          </div>
          
          {Object.keys(props).length > 0 && (
            <div className="text-left space-y-2 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">📦 Received Data:</span>
              </p>
              <pre className="text-xs bg-gray-50 p-3 rounded border border-gray-200 overflow-auto text-left">
                {JSON.stringify(props, null, 2)}
              </pre>
            </div>
          )}
        </div>
        
        <p className="text-sm text-gray-500">
          This view has access to Tailwind CSS v4, React 19, and can receive input via props
        </p>
      </div>
    </div>
  );
};`)
    .describe(
      "The React component code for the view. Must define 'export const App = (props) => { ... }'. The App component receives input data as props. Import React hooks from 'react'. The code will be rendered using React 19.2.0, has access to Tailwind CSS v4, and can call tools via the global callTool() function.",
    ),
  importmap: z
    .record(z.string(), z.string())
    .optional()
    .describe(
      "Optional import map for customizing module resolution. Defaults to React 19.2.0 imports. Example: { 'react': 'https://esm.sh/react@19.2.0', 'lodash': 'https://esm.sh/lodash' }",
    ),
  icon: z
    .string()
    .optional()
    .describe(
      "Optional icon URL for the view. If not provided, a default icon will be used.",
    ),
  tags: z
    .array(z.string())
    .optional()
    .describe("Optional tags for categorizing and searching views"),
});

export type ViewDefinition = z.infer<typeof ViewDefinitionSchema>;

import { z } from "zod";

/**
 * View Definition Schema
 *
 * This schema defines the structure for views using Resources 2.0
 * Views are React components that are rendered in an iframe with a standardized template
 */
export const ViewDefinitionSchema = z.object({
  name: z.string().min(1).describe("The name/title of the view"),
  description: z.string().describe("A brief description of the view's purpose"),
  code: z
    .string()
    .describe(
      "The React component code for the view. Must define 'export const App = () => { ... }'. Import React hooks from 'react'. The code will be rendered using React 19.2.0, has access to Tailwind CSS v4, and can call tools via the global callTool() function.",
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

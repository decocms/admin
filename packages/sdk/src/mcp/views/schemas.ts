import { z } from "zod";

/**
 * View Definition Schema
 *
 * This schema defines the structure for views using Resources 2.0
 * Views are UI components that render HTML content in an iframe
 */
export const ViewDefinitionSchema = z.object({
  name: z.string().min(1).describe("The name/title of the view"),
  description: z.string().describe("A brief description of the view's purpose"),
  html: z
    .string()
    .describe(
      "The HTML content for the view. This will be rendered in an iframe using srcdoc. Supports full HTML including CSS and JavaScript.",
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

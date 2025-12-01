import { z } from "zod";

/**
 * Document Definition Schema
 *
 * This schema defines the structure for documents using Resources 2.0
 * Documents are simple markdown-based content storage.
 */
export const DocumentDefinitionSchema = z.object({
  name: z.string().min(1).describe("The name/title of the document"),
  description: z
    .string()
    .describe("A brief description of the document's purpose or content"),
  content: z
    .string()
    .describe(
      "The document content in markdown format. Supports standard markdown syntax including headers, lists, links, code blocks, etc.",
    ),
  tags: z
    .array(z.string())
    .optional()
    .describe("Optional tags for categorizing and searching documents"),
});

export type DocumentDefinition = z.infer<typeof DocumentDefinitionSchema>;

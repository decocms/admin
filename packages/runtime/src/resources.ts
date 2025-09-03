import { z } from "zod";
import { lookup } from "mime-types";

// Base Resource Schema
const ResourceSchema = z.object({
  name: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  uri: z.string().url(),
  mimeType: z.string().optional(),
  annotations: z.record(z.string(), z.string()).optional(), // Allows additional fields
});

// Resource Variants
const ResourceTextContentSchema = ResourceSchema.extend({
  timestamp: z.string().datetime().optional(),
  size: z.number().positive().optional(),
  text: z.string(),
});

const ResourceBinaryContentSchema = ResourceSchema.extend({
  timestamp: z.string().datetime().optional(),
  size: z.number().positive().optional(),
  blob: z.string(), // base64-encoded data
});

// Tool Input/Output Schemas
export const ResourcesReadInputSchema = z.object({
  uri: z.string().url().describe(
    "The URI of the resource to read. It's important to add the url scheme. Use file:// for files. Use https:// or http:// for remote files",
  ),
});

export const ResourcesReadOutputSchema = z.union([
  ResourceTextContentSchema,
  ResourceBinaryContentSchema,
]);

export const ResourceSearchInputSchema = z.object({
  term: z.string().describe("The term to search for"),
  cursor: z.string().optional(),
  limit: z.number().positive().optional(),
});

export const ResourceSearchOutputSchema = z.object({
  items: z.array(ResourceSchema),
  hasMore: z.boolean(),
  nextCursor: z.string().optional(),
});

// Export Types
export type Resource = z.infer<typeof ResourceSchema>;
export type ResourceTextContent = z.infer<typeof ResourceTextContentSchema>;
export type ResourceBinaryContent = z.infer<typeof ResourceBinaryContentSchema>;
export type ResourcesReadInput = z.infer<typeof ResourcesReadInputSchema>;
export type ResourcesReadOutput = z.infer<typeof ResourcesReadOutputSchema>;
export type ResourcesSearchInput = z.infer<typeof ResourceSearchInputSchema>;
export type ResourcesSearchOutput = z.infer<typeof ResourceSearchOutputSchema>;

export const mimeType = (filePathOrExtension: string) =>
  lookup(filePathOrExtension) || "text/plain";

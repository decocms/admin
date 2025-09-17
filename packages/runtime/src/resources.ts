import { z } from "zod";
import { lookup } from "mime-types";

// Base Resource Schema (enhanced)
export const ResourceSchema = z.object({
  name: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  uri: z.string().url(),
  mimeType: z.string().optional(),
  thumbnail: z.string().url().optional(),
  timestamp: z.string().datetime().optional(),
  size: z.number().positive().optional(),
  annotations: z.record(z.string(), z.string()).optional(),
});

// Tool Input/Output Schemas (unified)
export const ResourcesReadInputSchema = z.object({
  name: z.string().describe("Resource type name (e.g., 'Page', 'GoogleDrive')"),
  uri: z
    .string()
    .url()
    .describe(
      "The URI of the resource to read. It's important to add the url scheme. Use file:// for files. Use https:// or http:// for remote files",
    ),
});

export const ResourcesReadOutputSchema = ResourceSchema.extend({
  data: z.string().describe("The resource content as a string"),
  type: z
    .enum(["text", "blob"])
    .describe(
      "Type of data: 'text' for plain text, 'blob' for base64-encoded binary",
    ),
});

export const ResourceSearchInputSchema = z.object({
  name: z.string().describe("Resource type name (e.g., 'Page', 'GoogleDrive')"),
  term: z.string().describe("The term to search for"),
  cursor: z.string().optional(),
  limit: z.number().positive().optional(),
});

export const ResourceSearchOutputSchema = z.object({
  items: z.array(ResourceSchema),
  hasMore: z.boolean(),
  nextCursor: z.string().optional(),
});

export const ResourceCreateInputSchema = z.object({
  name: z.string().describe("Resource type name (e.g., 'Page', 'GoogleDrive')"),
  resourceName: z
    .string()
    .describe(
      "Name of the specific resource instance. DO NOT ADD EXTENSIONS TO THE NAME",
    ),
  title: z.string().optional(),
  description: z.string().optional(),
  content: z
    .object({
      data: z.string(),
      type: z.enum(["text", "blob"]),
      mimeType: z.string().optional(),
    })
    .describe("Content to create the resource with"),
  metadata: z.record(z.string(), z.any()).optional(),
});
export const ResourceCreateOutputSchema = ResourceSchema;

export const ResourceUpdateInputSchema = z.object({
  name: z.string().describe("Resource type name (e.g., 'Page', 'GoogleDrive')"),
  uri: z.string().url().describe("URI of the resource to update"),
  resourceName: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  content: z
    .object({
      data: z.string(),
      type: z.enum(["text", "blob"]),
      mimeType: z.string().optional(),
    })
    .optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});
export const ResourceUpdateOutputSchema = ResourceSchema;

export const ResourceDeleteInputSchema = z.object({
  name: z.string().describe("Resource type name (e.g., 'Page', 'GoogleDrive')"),
  uri: z.string().url().describe("URI of the resource to delete"),
  force: z.boolean().optional(),
});
export const ResourceDeleteOutputSchema = z.object({
  deletedUri: z.string().url(),
});

export const ResourcesListInputSchema = z.object({});
export const ResourcesListOutputSchema = z.object({
  resources: z.array(
    z.object({
      name: z.string(),
      icon: z.string(),
      title: z.string(),
      description: z.string(),
      hasCreate: z.boolean().optional(),
      hasUpdate: z.boolean().optional(),
      hasDelete: z.boolean().optional(),
    }),
  ),
});

// Export Types
export type Resource = z.infer<typeof ResourceSchema>;
export type ResourcesReadInput = z.infer<typeof ResourcesReadInputSchema>;
export type ResourcesReadOutput = z.infer<typeof ResourcesReadOutputSchema>;
export type ResourcesSearchInput = z.infer<typeof ResourceSearchInputSchema>;
export type ResourcesSearchOutput = z.infer<typeof ResourceSearchOutputSchema>;
export type ResourceCreateInput = z.infer<typeof ResourceCreateInputSchema>;
export type ResourceCreateOutput = z.infer<typeof ResourceCreateOutputSchema>;
export type ResourceUpdateInput = z.infer<typeof ResourceUpdateInputSchema>;
export type ResourceUpdateOutput = z.infer<typeof ResourceUpdateOutputSchema>;
export type ResourceDeleteInput = z.infer<typeof ResourceDeleteInputSchema>;
export type ResourceDeleteOutput = z.infer<typeof ResourceDeleteOutputSchema>;
export type ResourcesListInput = z.infer<typeof ResourcesListInputSchema>;
export type ResourcesListOutput = z.infer<typeof ResourcesListOutputSchema>;

export const mimeType = (filePathOrExtension: string) =>
  lookup(filePathOrExtension) || "text/plain";

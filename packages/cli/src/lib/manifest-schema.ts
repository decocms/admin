import { z } from "zod";

/**
 * MCP Project Manifest Schema
 * Used for import/export of native AI app projects
 */

export const manifestProjectSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
});

export const manifestAuthorSchema = z.object({
  orgSlug: z.string().min(1),
  orgId: z.string().optional(),
  userId: z.string().optional(),
  userEmail: z.string().email().optional(),
});

export const manifestResourcesSchema = z.object({
  tools: z.array(z.string()),
  views: z.array(z.string()),
  workflows: z.array(z.string()),
  documents: z.array(z.string()),
});

export const manifestDependenciesSchema = z.object({
  mcps: z.array(z.string()),
});

export const manifestSchema = z.object({
  schemaVersion: z.literal("1.0"),
  project: manifestProjectSchema,
  author: manifestAuthorSchema,
  resources: manifestResourcesSchema,
  dependencies: manifestDependenciesSchema,
  createdAt: z.string().datetime(),
});

export type ManifestProject = z.infer<typeof manifestProjectSchema>;
export type ManifestAuthor = z.infer<typeof manifestAuthorSchema>;
export type ManifestResources = z.infer<typeof manifestResourcesSchema>;
export type ManifestDependencies = z.infer<typeof manifestDependenciesSchema>;
export type Manifest = z.infer<typeof manifestSchema>;

/**
 * Create a new manifest with required fields
 */
export function createManifest(
  project: ManifestProject,
  author: ManifestAuthor,
  resources: ManifestResources,
  dependencies: ManifestDependencies,
): Manifest {
  return {
    schemaVersion: "1.0",
    project,
    author,
    resources,
    dependencies,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Validate and parse a manifest object
 */
export function parseManifest(data: unknown): Manifest {
  return manifestSchema.parse(data);
}

/**
 * Check if a manifest is valid without throwing
 */
export function isValidManifest(data: unknown): data is Manifest {
  return manifestSchema.safeParse(data).success;
}

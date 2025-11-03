/**
 * ORGANIZATION_CREATE Tool
 *
 * Create a new organization using Better Auth organization plugin
 */

import { z } from "zod/v3";
import { defineTool } from "../../core/define-tool";
import { getUserId, requireAuth } from "../../core/mesh-context";

export const ORGANIZATION_CREATE = defineTool({
  name: "ORGANIZATION_CREATE",
  description: "Create a new organization",

  inputSchema: z.object({
    slug: z
      .string()
      .min(1)
      .max(50)
      .regex(
        /^[a-z0-9-]+$/,
        "Slug must be lowercase alphanumeric with hyphens",
      ),
    name: z.string().min(1).max(255),
    description: z.string().optional(),
  }),

  outputSchema: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    logo: z.string().nullable().optional(),
    metadata: z.any().optional(),
    createdAt: z.union([z.date(), z.string()]),
    members: z.array(z.any()).optional(),
  }),

  handler: async (input, ctx) => {
    // Require authentication
    requireAuth(ctx);

    // Check authorization
    await ctx.access.check();

    // Get user ID
    const userId = getUserId(ctx);
    if (!userId) {
      throw new Error("User ID required to create organization");
    }

    // Create organization via Better Auth
    const result = await ctx.authInstance.api.createOrganization({
      body: {
        name: input.name,
        slug: input.slug,
        metadata: input.description
          ? { description: input.description }
          : undefined,
        userId, // Server-side creation
      },
    });

    if (!result) {
      throw new Error("Failed to create organization");
    }

    return result;
  },
});

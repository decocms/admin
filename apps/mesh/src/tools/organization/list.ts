/**
 * ORGANIZATION_LIST Tool
 *
 * List all organizations the user has access to
 */

import { z } from "zod";
import { defineTool } from "../../core/define-tool";
import { getUserId, requireAuth } from "../../core/mesh-context";

export const ORGANIZATION_LIST = defineTool({
  name: "ORGANIZATION_LIST",
  description: "List all organizations user has access to",

  inputSchema: z.object({
    userId: z.string().optional(), // Optional: filter by user
  }),

  outputSchema: z.object({
    organizations: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        slug: z.string(),
        logo: z.string().nullable().optional(),
        metadata: z.any().optional(),
        createdAt: z.union([z.date(), z.string()]),
      }),
    ),
  }),

  handler: async (input, ctx) => {
    // Require authentication
    requireAuth(ctx);

    // // Check authorization
    await ctx.access.check();

    // // Get current user ID
    const currentUserId = getUserId(ctx);
    const userId = input.userId || currentUserId;

    if (!userId) {
      throw new Error("User ID required to list organizations");
    }

    const organizations = await ctx.authInstance.api.listOrganizations({
      query: {
        userId,
      },
    });

    return {
      organizations,
    };
  },
});

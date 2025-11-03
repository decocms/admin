/**
 * ORGANIZATION_GET Tool
 *
 * Get organization details by slug or ID
 */

import { z } from "zod/v3";
import { defineTool } from "../../core/define-tool";
import { requireAuth } from "../../core/mesh-context";

export const ORGANIZATION_GET = defineTool({
  name: "ORGANIZATION_GET",
  description: "Get organization details by slug or ID",

  inputSchema: z.object({
    // No input needed - uses active organization from context
  }),

  outputSchema: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    logo: z.string().nullable().optional(),
    metadata: z.any().optional(),
    createdAt: z.union([z.date(), z.string()]),
    members: z.array(z.any()).optional(),
    invitations: z.array(z.any()).optional(),
  }),

  handler: async (_input, ctx) => {
    // Require authentication
    requireAuth(ctx);

    // Check authorization
    await ctx.access.check();

    // Get full organization via Better Auth
    // This uses the active organization from session
    const organization = await ctx.authInstance.api.getFullOrganization({
      headers: new Headers(), // Better Auth needs Headers object
    });

    if (!organization) {
      throw new Error("No active organization found");
    }

    return organization;
  },
});

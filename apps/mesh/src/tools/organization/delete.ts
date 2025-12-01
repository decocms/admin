/**
 * ORGANIZATION_DELETE Tool
 *
 * Delete an organization
 */

import { z } from "zod";
import { defineTool } from "../../core/define-tool";
import { requireAuth } from "../../core/mesh-context";

export const ORGANIZATION_DELETE = defineTool({
  name: "ORGANIZATION_DELETE",
  description: "Delete an organization",

  inputSchema: z.object({
    id: z.string(),
  }),

  outputSchema: z.object({
    success: z.boolean(),
    id: z.string(),
  }),

  handler: async (input, ctx) => {
    // Require authentication
    requireAuth(ctx);

    // Check authorization
    await ctx.access.check();

    // Delete organization via Better Auth
    await ctx.authInstance.api.deleteOrganization({
      body: {
        organizationId: input.id,
      },
      headers: new Headers(), // Better Auth requires headers
    });

    return {
      success: true,
      id: input.id,
    };
  },
});

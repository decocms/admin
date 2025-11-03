/**
 * ORGANIZATION_MEMBER_ADD Tool
 *
 * Add a member to an organization
 */

import { z } from "zod/v3";
import { defineTool } from "../../core/define-tool";
import { requireAuth } from "../../core/mesh-context";

export const ORGANIZATION_MEMBER_ADD = defineTool({
  name: "ORGANIZATION_MEMBER_ADD",
  description: "Add a member to an organization",

  inputSchema: z.object({
    organizationId: z.string().optional(), // Optional: defaults to active organization
    userId: z.string(),
    role: z.array(z.string()), // Array of role names (e.g., ["admin"], ["member"])
  }),

  handler: async (input, ctx) => {
    // Require authentication
    requireAuth(ctx);

    // Check authorization
    await ctx.access.check();

    // Use active organization if not specified
    const organizationId = input.organizationId || ctx.organization?.id;
    if (!organizationId) {
      throw new Error(
        "Organization ID required (no active organization in context)",
      );
    }

    // Add member via Better Auth
    const result = await ctx.authInstance.api.addMember({
      body: {
        organizationId,
        userId: input.userId,
        role: input.role,
      } as any, // Better Auth has strict role types but we allow any string array
    });

    if (!result) {
      throw new Error("Failed to add member");
    }

    return result;
  },
});

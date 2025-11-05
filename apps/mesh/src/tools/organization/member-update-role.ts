/**
 * ORGANIZATION_MEMBER_UPDATE_ROLE Tool
 *
 * Update a member's role in an organization
 */

import { z } from "zod/v3";
import { defineTool } from "../../core/define-tool";
import { requireAuth } from "../../core/mesh-context";

export const ORGANIZATION_MEMBER_UPDATE_ROLE = defineTool({
  name: "ORGANIZATION_MEMBER_UPDATE_ROLE",
  description: "Update a member's role in an organization",

  inputSchema: z.object({
    organizationId: z.string().optional(), // Optional: defaults to active organization
    memberId: z.string(),
    role: z.array(z.string()), // Array of role names (e.g., ["admin"], ["member"])
  }),

  outputSchema: z.object({
    id: z.string(),
    organizationId: z.string(),
    userId: z.string(),
    role: z.union([z.literal("admin"), z.literal("member"), z.literal("owner")]),
    createdAt: z.union([z.date(), z.string()]),
    user: z.object({
      email: z.string(),
      name: z.string(),
      image: z.string().optional(),
    }),
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

    // Update member role via Better Auth
    const result = await ctx.authInstance.api.updateMemberRole({
      body: {
        organizationId,
        memberId: input.memberId,
        role: input.role,
      } as { organizationId: string; memberId: string; role: string[] },
    });

    if (!result) {
      throw new Error("Failed to update member role");
    }

    return result;
  },
});

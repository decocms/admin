/**
 * ORGANIZATION_MEMBER_ADD Tool
 *
 * Add a member to an organization
 */

import { z } from "zod";
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

  outputSchema: z.object({
    id: z.string(),
    organizationId: z.string(),
    userId: z.string(),
    role: z.union([z.string(), z.array(z.string())]), // Better Auth can return string or array
    createdAt: z.union([z.date(), z.string()]),
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
    const result = await ctx.boundAuth.organization.addMember({
      organizationId,
      userId: input.userId,
      role: input.role,
    });

    if (!result) {
      throw new Error("Failed to add member");
    }

    // Better Auth returns role as string, but we accept string or array
    return result as typeof result & { role: string | string[] };
  },
});

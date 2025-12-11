import { z } from "zod";
import { defineTool } from "../../core/define-tool";
import { requireAuth } from "../../core/mesh-context";
import { SidebarItemSchema } from "./schema.ts";

export const ORGANIZATION_SETTINGS_GET = defineTool({
  name: "ORGANIZATION_SETTINGS_GET",
  description: "Get organization-level settings",

  inputSchema: z.object({
    organizationId: z.string(),
  }),

  outputSchema: z.object({
    organizationId: z.string(),
    sidebar_items: z.array(SidebarItemSchema).nullable().optional(),
    createdAt: z.union([z.date(), z.string()]).optional(),
    updatedAt: z.union([z.date(), z.string()]).optional(),
  }),

  handler: async (input, ctx) => {
    requireAuth(ctx);
    await ctx.access.check();

    if (ctx.organization && ctx.organization.id !== input.organizationId) {
      throw new Error("Cannot access settings for a different organization");
    }

    const settings = await ctx.storage.organizationSettings.get(
      input.organizationId,
    );

    if (!settings) {
      return {
        organizationId: input.organizationId,
      };
    }

    return settings;
  },
});

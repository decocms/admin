import { z } from "zod";
import { defineTool } from "../../core/define-tool";
import { requireAuth } from "../../core/mesh-context";

const SidebarItemSchema = z.object({
  title: z.string(),
  url: z.string(),
  connectionId: z.string(),
});

export const ORGANIZATION_SETTINGS_UPDATE = defineTool({
  name: "ORGANIZATION_SETTINGS_UPDATE",
  description: "Update organization-level settings",

  inputSchema: z.object({
    organizationId: z.string(),
    sidebar_items: z.array(SidebarItemSchema).optional(),
  }),

  outputSchema: z.object({
    organizationId: z.string(),
    sidebar_items: z.array(SidebarItemSchema).nullable().optional(),
    createdAt: z.union([z.date(), z.string()]),
    updatedAt: z.union([z.date(), z.string()]),
  }),

  handler: async (input, ctx) => {
    requireAuth(ctx);
    await ctx.access.check();

    if (ctx.organization && ctx.organization.id !== input.organizationId) {
      throw new Error("Cannot update settings for a different organization");
    }

    const settings = await ctx.storage.organizationSettings.upsert(
      input.organizationId,
      {
        sidebar_items: input.sidebar_items,
      },
    );

    return settings;
  },
});

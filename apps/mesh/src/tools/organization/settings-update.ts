import { z } from "zod/v3";
import { defineTool } from "../../core/define-tool";
import { requireAuth } from "../../core/mesh-context";

export const ORGANIZATION_SETTINGS_UPDATE = defineTool({
  name: "ORGANIZATION_SETTINGS_UPDATE",
  description: "Update organization-level settings",

  inputSchema: z.object({
    organizationId: z.string(),
  }),

  outputSchema: z.object({
    organizationId: z.string(),
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
    );

    return settings;
  },
});

import { z } from "zod/v3";
import { defineTool } from "../../core/define-tool";
import { requireAuth } from "../../core/mesh-context";

export const ORGANIZATION_SETTINGS_UPDATE = defineTool({
  name: "ORGANIZATION_SETTINGS_UPDATE",
  description:
    "Update organization-level settings such as the MODELS binding connection",

  inputSchema: z.object({
    organizationId: z.string(),
    modelsBindingConnectionId: z.string().nullable().optional(),
  }),

  outputSchema: z.object({
    organizationId: z.string(),
    modelsBindingConnectionId: z.string().nullable(),
    createdAt: z.union([z.date(), z.string()]),
    updatedAt: z.union([z.date(), z.string()]),
  }),

  handler: async (input, ctx) => {
    requireAuth(ctx);
    await ctx.access.check();

    if (ctx.organization && ctx.organization.id !== input.organizationId) {
      throw new Error("Cannot update settings for a different organization");
    }

    const connectionId =
      input.modelsBindingConnectionId === undefined
        ? null
        : input.modelsBindingConnectionId;

    if (connectionId) {
      const connection = await ctx.storage.connections.findById(connectionId);
      if (!connection) {
        throw new Error(
          `Connection not found for MODELS binding: ${connectionId}`,
        );
      }

      if (connection.organizationId !== input.organizationId) {
        throw new Error(
          "Connection does not belong to the specified organization",
        );
      }
    }

    const settings = await ctx.storage.organizationSettings.upsert(
      input.organizationId,
      { modelsBindingConnectionId: connectionId },
    );

    return settings;
  },
});

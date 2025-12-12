/**
 * API_KEY_UPDATE Tool
 *
 * Update an existing API key's name, permissions, or metadata.
 */

import { defineTool } from "../../core/define-tool";
import { getUserId, requireAuth } from "../../core/mesh-context";
import { ApiKeyUpdateInputSchema, ApiKeyUpdateOutputSchema } from "./schema";

export const API_KEY_UPDATE = defineTool({
  name: "API_KEY_UPDATE",
  description:
    "Update an existing API key's name, permissions, or metadata. Note: Key value cannot be changed or retrieved.",

  inputSchema: ApiKeyUpdateInputSchema,
  outputSchema: ApiKeyUpdateOutputSchema,

  handler: async (input, ctx) => {
    // Require authentication
    requireAuth(ctx);

    // Check authorization for this tool
    await ctx.access.check();

    // Get the current user ID for ownership verification
    const userId = getUserId(ctx);
    if (!userId) {
      throw new Error("User ID required to update API key");
    }

    // Update the API key via Better Auth
    const result = await ctx.boundAuth.apiKey.update({
      keyId: input.keyId,
      name: input.name,
      permissions: input.permissions,
      metadata: input.metadata,
    });

    if (!result) {
      throw new Error(`API key not found: ${input.keyId}`);
    }

    // Return the updated key (without key value)
    return {
      item: {
        id: result.id,
        name: result.name ?? input.name ?? "Unnamed Key", // Fallback if name is null
        userId: result.userId,
        permissions: result.permissions ?? {},
        expiresAt: result.expiresAt ?? null,
        createdAt: result.createdAt,
      },
    };
  },
});

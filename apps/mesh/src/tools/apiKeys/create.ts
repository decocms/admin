/**
 * API_KEY_CREATE Tool
 *
 * Create a new API key with specified permissions.
 * IMPORTANT: The key value is only returned here and cannot be retrieved later.
 */

import { defineTool } from "../../core/define-tool";
import { getUserId, requireAuth } from "../../core/mesh-context";
import { ApiKeyCreateInputSchema, ApiKeyCreateOutputSchema } from "./schema";

export const API_KEY_CREATE = defineTool({
  name: "API_KEY_CREATE",
  description:
    "Create a new API key with specified permissions. The key value is only returned once - store it securely!",

  inputSchema: ApiKeyCreateInputSchema,
  outputSchema: ApiKeyCreateOutputSchema,

  handler: async (input, ctx) => {
    // Require authentication - users must be logged in to create API keys
    requireAuth(ctx);

    // Check authorization for this tool
    await ctx.access.check();

    // Get the current user ID
    const userId = getUserId(ctx);
    if (!userId) {
      throw new Error("User ID required to create API key");
    }

    // Create the API key via Better Auth
    const result = await ctx.boundAuth.apiKey.create({
      name: input.name,
      permissions: input.permissions,
      expiresIn: input.expiresIn,
      metadata: input.metadata,
    });

    // Return the created key with its value (only time it's visible)
    return {
      id: result.id,
      name: result.name ?? input.name, // Fallback to input name if null
      key: result.key, // This is the only time the key value is returned!
      permissions: result.permissions ?? {},
      expiresAt: result.expiresAt ?? null,
      createdAt: result.createdAt,
    };
  },
});

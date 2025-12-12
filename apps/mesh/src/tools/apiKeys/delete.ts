/**
 * API_KEY_DELETE Tool
 *
 * Delete an API key (instant revocation).
 */

import { defineTool } from "../../core/define-tool";
import { getUserId, requireAuth } from "../../core/mesh-context";
import { ApiKeyDeleteInputSchema, ApiKeyDeleteOutputSchema } from "./schema";

export const API_KEY_DELETE = defineTool({
  name: "API_KEY_DELETE",
  description:
    "Delete an API key. This instantly revokes the key - it can no longer be used for authentication.",

  inputSchema: ApiKeyDeleteInputSchema,
  outputSchema: ApiKeyDeleteOutputSchema,

  handler: async (input, ctx) => {
    // Require authentication
    requireAuth(ctx);

    // Check authorization for this tool
    await ctx.access.check();

    // Get the current user ID for ownership verification
    const userId = getUserId(ctx);
    if (!userId) {
      throw new Error("User ID required to delete API key");
    }

    // Delete the API key via Better Auth
    await ctx.boundAuth.apiKey.delete(input.keyId);

    return {
      success: true,
      keyId: input.keyId,
    };
  },
});

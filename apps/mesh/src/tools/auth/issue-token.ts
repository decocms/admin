import { createMCPProxy } from "@/api/routes/proxy";
import { defineTool } from "@/core/define-tool";
import { requireAuth } from "@/core/mesh-context";
import { z } from "zod";

export const CALL_TOOL = defineTool({
  name: "CALL_TOOL",
  inputSchema: z.object({
    connection: z.string(),
    tool: z.string(),
    arguments: z.record(z.any()).optional(),
  }),
  outputSchema: z.object({
    response: z.any(),
  }),
  description: "Issue a signed JWT with mesh token payload",
  handler: async (props, ctx) => {
    requireAuth(ctx);
    await ctx.access.check();
    const proxy = await createMCPProxy(props.connection, ctx);
    const response = await proxy.client.callTool({
      name: props.tool,
      arguments: props.arguments ?? {},
    });
    return {
      response: response.structuredContent ?? response.content,
    };
  },
});

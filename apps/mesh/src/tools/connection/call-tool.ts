import { createMCPProxy } from "@/api/routes/proxy";
import { defineTool } from "@/core/define-tool";
import { requireAuth } from "@/core/mesh-context";
import { z } from "zod";

export const CONNECTION_CALL_TOOL = defineTool({
  name: "CONNECTION_CALL_TOOL",
  inputSchema: z.object({
    connectionId: z.string(),
    toolName: z.string(),
    arguments: z.record(z.any()).optional(),
  }),
  outputSchema: z.object({
    result: z.object({
      isError: z.boolean().optional(),
      content: z.unknown(),
      structuredContent: z.record(z.unknown()).optional(),
      _meta: z.unknown().optional(),
    }),
  }),
  description: "Call a tool using the MCP proxy",
  handler: async (props, ctx) => {
    requireAuth(ctx);
    await ctx.access.check();
    const proxy = await createMCPProxy(props.connectionId, {
      ...ctx,
      auth: {
        user: { id: ctx.auth.user?.id ?? "", role: "owner" }, // lol someone pls help me here
      },
    });
    const result = await proxy.client.callTool({
      name: props.toolName,
      arguments: props.arguments ?? {},
    });
    return { result };
  },
});

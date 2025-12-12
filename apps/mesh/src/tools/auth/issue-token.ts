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
    response: z.unknown(),
  }),
  description: "Call a tool using the MCP proxy",
  handler: async (props, ctx) => {
    try {
      requireAuth(ctx);
      await ctx.access.check();
      const proxy = await createMCPProxy(props.connection, ctx);
      const response = await proxy.client.callTool({
        name: props.tool,
        arguments: props.arguments ?? {},
      });
      // const tools = await proxy.client.listTools()

      return { response: response.structuredContent ?? response.content };
    } catch (error) {
      console.error({ error });
      throw error;
    }
  },
});

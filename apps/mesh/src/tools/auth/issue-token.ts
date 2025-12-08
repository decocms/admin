import { responseToStream } from "@/api/llm-provider";
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
    try {
      requireAuth(ctx);
      await ctx.access.check();
      const proxy = await createMCPProxy(props.connection, ctx);
      const response = await proxy.callStreamableTool(
        props.tool,
        props.arguments ?? {},
      );

      const stream = responseToStream(response);
      const reader = stream.getReader();
      let result = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        result += value;
      }
      return { response: result };
    } catch (error) {
      console.error({ error });
      throw error;
    }
  },
});

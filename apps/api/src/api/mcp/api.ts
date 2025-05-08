import { IntegrationSchema } from "@deco/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { z } from "zod";
import { assertUserHasAccessToWorkspace } from "../../auth/assertions.ts";
import { createApiHandler } from "../../utils/context.ts";
import { getTransportFor } from "../../utils/transport.ts";

export const listIntegrationTools = createApiHandler({
  name: "MCP_LIST_TOOLS",
  description: "List all tools for an integration",
  schema: z.object({
    connection: IntegrationSchema.shape.connection,
  }),
  handler: async ({ connection }, c) => {
    const root = c.req.param("root");
    const slug = c.req.param("slug");

    await assertUserHasAccessToWorkspace(root, slug, c);

    const transport = getTransportFor(connection);
    const client = new Client({ name: "deco-chat", version: "1.0.0" });

    await client.connect(transport);

    const tools = await client.listTools();

    return tools;
  },
});

export const callIntegrationTool = createApiHandler({
  name: "MCP_CALL_TOOL",
  description: "Call a tool for an integration",
  schema: z.object({
    connection: IntegrationSchema.shape.connection,
    tool: z.object({
      name: z.string(),
      arguments: z.record(z.any()),
    }),
  }),
  handler: async ({ connection, tool }, c) => {
    const root = c.req.param("root");
    const slug = c.req.param("slug");

    await assertUserHasAccessToWorkspace(root, slug, c);

    const transport = getTransportFor(connection);
    const client = new Client({ name: "deco-chat", version: "1.0.0" });

    await client.connect(transport);

    const result = await client.callTool(tool);

    return result;
  },
});

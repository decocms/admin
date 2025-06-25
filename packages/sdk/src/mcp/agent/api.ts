import type { AIAgent } from "@deco/ai";
import { z } from "zod";
import { AgentGenerateOptions } from "../../models/index.ts";
import { stub } from "../../stub.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
  type WithTool,
} from "../assertions.ts";
import { type AppContext, createToolFactory } from "../context.ts";

export interface AgentContext extends AppContext {
  agent: string;
}

const createAgentTool = createToolFactory<WithTool<AgentContext>>((c) =>
  ({
    ...c,
    agent: c.params.agentId ?? "teamAgent",
  }) as unknown as WithTool<AgentContext>
);

export const agentGenerateText = createAgentTool(
  {
    name: "AGENT_GENERATE_TEXT",
    description: "Generate text output using an agent",
    inputSchema: z.object({
      message: z.string().describe("The message to send to the agent"),
      options: AgentGenerateOptions.optional().nullable(),
    }),
    outputSchema: z.object({
      text: z.string().optional().describe("The text output from the agent"),
    }),
    handler: async ({ message }, c) => {
      assertHasWorkspace(c);
      await assertWorkspaceResourceAccess(c.tool.name, c);

      const agentStub = stub<AIAgent>("AIAgent")
        .new(`${c.workspace.value}/Agents/${c.agent}`);

      const response = await agentStub.generate([{
        id: crypto.randomUUID(),
        role: "user" as const,
        content: message,
      }]);

      return response;
    },
  },
);

export const agentGenerateObject = createAgentTool(
  {
    name: "AGENT_GENERATE_OBJECT",
    description: "Generate an object using an agent",
    inputSchema: z.object({
      message: z.string().describe("The message to send to the agent"),
      schema: z.any().describe(
        "The JSON schema to use for a structured response. If provided, the response will be an object.",
      ),
    }),
    outputSchema: z.object({
      object: z.any().describe("The object output from the agent"),
    }),
    handler: async ({ message, schema }, c) => {
      assertHasWorkspace(c);
      await assertWorkspaceResourceAccess(c.tool.name, c);

      const agentStub = stub<AIAgent>("AIAgent")
        .new(`${c.workspace.value}/Agents/${c.agent}`);

      const response = await agentStub.generateObject([{
        id: crypto.randomUUID(),
        role: "user" as const,
        content: message,
      }], schema);

      return response;
    },
  },
);

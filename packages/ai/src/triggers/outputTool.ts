import { ToolAction } from "@mastra/core";
import { DecoChatStorage } from "../storage/index.ts";
import { ActorProxy } from "@deco/actors";
import type { Workspace } from "@deco/sdk/path";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { AIAgent } from "../agent.ts";
import type { Message } from "../types.ts";
import type { Trigger } from "./trigger.ts";
import { mcpServerTools } from "../mcp.ts";
import { slugify } from "../utils/slugify.ts";

export interface RunOutputToolArgs {
  agent: ActorProxy<AIAgent>;
  outputTool: string;
  storage: DecoChatStorage;
  workspace: Workspace;
}

interface RunOutputToolError {
  error: string;
  status: number;
  details?: unknown;
}

interface RunOutputToolSuccess {
  tool: ToolAction;
  schema: ReturnType<typeof zodToJsonSchema>;
}

export type RunOutputToolResult = RunOutputToolError | RunOutputToolSuccess;

export async function getOutputTool(
  { agent, outputTool, storage, workspace }: RunOutputToolArgs,
): Promise<RunOutputToolResult> {
  const [integrationId, toolId] = outputTool.split("/");
  if (!integrationId || !toolId) {
    return {
      error: "Invalid outputTool format",
      status: 400,
      details: { outputTool },
    };
  }

  const integration = await storage.integrations.for(workspace)
    .get(integrationId);

  if (!integration) {
    return {
      error: "Integration not found",
      status: 404,
      details: { integrationId },
    };
  }

  const tools = await mcpServerTools(integration, agent as unknown as AIAgent);
  const maybeTool = tools[slugify(toolId)];
  if (!maybeTool || !maybeTool.execute) {
    return {
      error: "Tool not found",
      status: 404,
      details: { toolId },
    };
  }

  const schema = zodToJsonSchema(maybeTool.inputSchema);
  return { tool: maybeTool, schema };
}

export const handleOutputTool = async ({
  outputTool,
  agent,
  messages,
  trigger,
  workspace,
}: {
  outputTool: string;
  agent: ActorProxy<AIAgent>;
  messages: Message[];
  trigger: Trigger;
  workspace: Workspace;
}) => {
  try {
    const getToolResult = await getOutputTool({
      agent,
      outputTool,
      storage: trigger.storage as DecoChatStorage,
      workspace,
    });

    if ("error" in getToolResult) {
      return Response.json({
        error: getToolResult.error,
        ...(getToolResult.details && typeof getToolResult.details === "object"
          ? getToolResult.details
          : {}),
      }, { status: getToolResult.status });
    }

    const { tool, schema } = getToolResult;
    // deno-lint-ignore no-explicit-any
    const toolArgs =
      (await agent.generateObject(messages, schema as any)).object;

    // deno-lint-ignore no-explicit-any
    const result = await tool.execute!({ context: toolArgs } as any);

    return {
      args: toolArgs,
      result,
    };
  } catch (err) {
    console.error("Error calling output tool", err);
    return Response.json({
      message: "Error calling webhook with output tool",
      error: err instanceof Error ? err.message : err,
    }, { status: 500 });
  }
};

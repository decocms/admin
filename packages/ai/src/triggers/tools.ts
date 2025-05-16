import { Path } from "@deco/sdk/path";
import { join } from "node:path/posix";
import { createInnateTool } from "../utils/createTool.ts";
import type { TriggerData } from "./services.ts";
import {
  buildWebhookUrl,
  createCronTrigger,
  CreateCronTriggerInputSchema,
  CreateCronTriggerOutputSchema,
  createWebhookTrigger,
  CreateWebhookTriggerInputSchema,
  CreateWebhookTriggerOutputSchema,
  deleteTrigger,
  DeleteTriggerInputSchema,
  DeleteTriggerOutputSchema,
  GetWebhookTriggerUrlInputSchema,
  GetWebhookTriggerUrlOutputSchema,
  listTriggers,
  ListTriggersOutputSchema,
} from "./services.ts";

/**
 * Creates a new trigger tool
 */
export const DECO_TRIGGER_CREATE_CRON = createInnateTool({
  id: "DECO_TRIGGER_CREATE_CRON",
  description:
    "Create a new cron trigger with specified expression and tool call",
  inputSchema: CreateCronTriggerInputSchema,
  outputSchema: CreateCronTriggerOutputSchema,
  execute: (agent) => async ({ context, resourceId }) => {
    return await createCronTrigger({
      stub: agent.state.stub,
      workspace: agent.workspace,
      agentId: agent.state.id.split("/").at(-1) ?? "",
      trigger: context,
      resourceId,
      userId: agent.metadata?.principal?.id ?? "",
      mcpClient: agent.metadata!.mcpClient!,
    });
  },
});

/**
 * Creates a new trigger tool
 */
export const DECO_TRIGGER_CREATE_WEBHOOK = createInnateTool({
  id: "DECO_TRIGGER_CREATE_WEBHOOK",
  description:
    "Creates a new webhook trigger with specified passphrase that is used to invoke the agent back",
  inputSchema: CreateWebhookTriggerInputSchema,
  outputSchema: CreateWebhookTriggerOutputSchema,
  execute: (agent) => async ({ context, resourceId }) => {
    return await createWebhookTrigger({
      stub: agent.state.stub,
      workspace: agent.workspace,
      agentId: agent.state.id.split("/").at(-1) ?? "",
      trigger: context,
      resourceId,
      mcpClient: agent.metadata!.mcpClient!,
    });
  },
});

/**
 * Creates a tool for deleting triggers
 */
export const DECO_TRIGGER_DELETE = createInnateTool({
  id: "DECO_TRIGGER_DELETE",
  description: "Delete a trigger by its ID",
  inputSchema: DeleteTriggerInputSchema,
  outputSchema: DeleteTriggerOutputSchema,
  execute: (agent) => async ({ context }) => {
    return await deleteTrigger({
      stub: agent.state.stub,
      workspace: agent.workspace,
      agentId: agent.state.id.split("/").at(-1) ?? "",
      triggerId: context.id,
      mcpClient: agent.metadata!.mcpClient!,
    });
  },
});

/**
 * Creates a tool for listing all triggers
 */
export const DECO_TRIGGER_LIST = createInnateTool({
  id: "DECO_TRIGGER_LIST",
  description: "List all triggers for the current agent",
  outputSchema: ListTriggersOutputSchema,
  execute: (agent) => async () => {
    const agentId = agent.state.id.split("/").at(-1) ?? "";
    const triggers = await listTriggers(
      agent.metadata!.mcpClient!,
      agentId,
    );
    return {
      success: true,
      message: "Triggers listed successfully",
      triggers: triggers.map((trigger) => ({
        id: trigger.id,
        data: trigger.data,
      })),
    };
  },
});

/**
 * Creates a tool for getting webhook trigger URLs
 */
export const DECO_TRIGGER_GET_WEBHOOK_URL = createInnateTool({
  id: "DECO_TRIGGER_GET_WEBHOOK_URL",
  description: "Get the webhook URL for a specific trigger ID",
  inputSchema: GetWebhookTriggerUrlInputSchema,
  outputSchema: GetWebhookTriggerUrlOutputSchema,
  execute: (agent) => async ({ context }) => {
    try {
      const client = agent.metadata!.mcpClient!;

      const response = await client.TRIGGERS_GET({ id: context.id });

      if (
        !response || !response?.trigger || response.trigger.type !== "webhook"
      ) {
        return {
          success: false,
          message: "Trigger not found",
        };
      }

      const triggerId = join(
        agent.state.id,
        Path.folders.trigger(context.id),
      );

      return {
        success: true,
        message: "Webhook URL retrieved successfully",
        url: buildWebhookUrl(
          triggerId,
          (response.trigger as unknown as { passphrase: string }).passphrase,
        ),
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get webhook URL: ${error}`,
      };
    }
  },
});

export const tools = {
  DECO_TRIGGER_CREATE_CRON,
  DECO_TRIGGER_CREATE_WEBHOOK,
  DECO_TRIGGER_DELETE,
  DECO_TRIGGER_LIST,
  DECO_TRIGGER_GET_WEBHOOK_URL,
} as const;

export const threadOf = (
  data: TriggerData,
  url?: URL,
): { threadId: string | undefined; resourceId: string | undefined } => {
  const resourceId = data.resourceId ?? url?.searchParams.get("resourceId") ??
    undefined;
  const threadId = url?.searchParams.get("threadId") ??
    (resourceId ? crypto.randomUUID() : undefined); // generate a random threadId if resourceId exists.
  return { threadId, resourceId };
};

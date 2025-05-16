import { createApiHandler } from "../context.ts";
import { z } from "zod";
import { assertHasWorkspace, assertUserHasAccessToWorkspace } from "../assertions.ts";
import { getAgentsByIds } from "../agents/api.ts";
import {
  AgentSchema,
  CreateCronTriggerInputSchema,
  CreateTriggerOutputSchema,
  CreateWebhookTriggerInputSchema,
  DeleteTriggerOutputSchema,
  GetWebhookTriggerUrlOutputSchema,
  ListTriggersOutputSchema,
  TriggerSchema,
} from "@deco/sdk";
import { userFromDatabase } from "../user.ts";
import { Database, Json } from "@deco/sdk/storage";
import { Trigger } from "@deco/ai/actors";
import { Path } from "@deco/sdk/path";
import { join } from "node:path";
import { Hosts } from "@deco/sdk/hosts";

const SELECT_TRIGGER_QUERY = `
  *,
  profile:profiles(
    metadata:users_meta_data_view(
      raw_user_meta_data
    )
  )
`;

function mapTrigger(
  trigger: Database["public"]["Tables"]["deco_chat_triggers"]["Row"],
  agentsById: Record<string, z.infer<typeof AgentSchema>>,
) {
  return {
    id: trigger.id,
    agent: agentsById[trigger.agent_id],
    created_at: trigger.created_at,
    updated_at: trigger.updated_at,
    user: {
      // @ts-expect-error - Supabase user metadata is not typed
      ...userFromDatabase(trigger.profile),
      id: trigger.user_id,
      // @ts-expect-error - Supabase user metadata is not typed
    } as z.infer<typeof ListTriggersOutputSchema["triggers"][number]["user"]>,
    workspace: trigger.workspace,
    data: trigger.metadata as z.infer<typeof TriggerSchema>,
  };
}

export const buildWebhookUrl = (
  triggerId: string,
  passphrase: string | undefined,
) => {
  return `https://${Hosts.API}/actors/${Trigger.name}/invoke/run?passphrase=${passphrase}&deno_isolate_instance_id=${triggerId}`;
};

export const listTriggers = createApiHandler({
  name: "TRIGGERS_LIST",
  description: "List all triggers",
  schema: z.object({ agentId: z.string().optional() }),
  handler: async (
    { agentId },
    c,
  ): Promise<z.infer<typeof ListTriggersOutputSchema>> => {
    assertHasWorkspace(c);
    const db = c.db;
    const workspace = c.workspace.value;

    await assertUserHasAccessToWorkspace(c);

    const query = db
      .from("deco_chat_triggers")
      .select(SELECT_TRIGGER_QUERY)
      .eq("workspace", workspace);

    if (agentId) {
      query.eq("agent_id", agentId);
    }

    const { data, error } = await query;

    if (error) {
      return {
        success: false,
        message: "Failed to list triggers",
        triggers: [],
      };
    }

    const agentIds = Array.from(
      new Set(data.map((trigger) => trigger.agent_id).filter(Boolean)),
    );

    const agents = await getAgentsByIds(agentIds, c);

    const agentsById = agents.reduce((acc, agent) => {
      acc[agent.id] = agent;
      return acc;
    }, {} as Record<string, z.infer<typeof AgentSchema>>);

    return {
      success: true,
      message: "Triggers listed successfully",
      triggers: data.map((trigger) => mapTrigger(trigger, agentsById)),
    };
  },
});

export const createTrigger = createApiHandler({
  name: "TRIGGERS_CREATE",
  description: "Create a trigger",
  schema: z.object({ agentId: z.string(), data: TriggerSchema }),
  handler: async (
    { agentId, data },
    c,
  ): Promise<z.infer<typeof CreateTriggerOutputSchema>> => {
    assertHasWorkspace(c);
    const db = c.db;
    const workspace = c.workspace.value;
    const user = c.user;
    const stub = c.stub;

    await assertUserHasAccessToWorkspace(c);

    const id = crypto.randomUUID();

    const triggerId = Path.resolveHome(
      join(Path.folders.Agent.root(agentId), Path.folders.trigger(id)),
      workspace,
    ).path;

    if (data.type === "cron") {
      const parse = CreateCronTriggerInputSchema.safeParse(data);
      if (!parse.success) {
        return {
          success: false,
          message: "Invalid trigger",
          trigger: null,
        };
      }
    }

    if (data.type === "webhook") {
      const parse = CreateWebhookTriggerInputSchema.safeParse(data);
      if (!parse.success) {
        return {
          success: false,
          message: "Invalid trigger",
          trigger: null,
        };
      }
      (data as z.infer<typeof TriggerSchema> & { url: string }).url =
        buildWebhookUrl(triggerId, data.passphrase);
    }

    try {
      await stub(Trigger).new(triggerId).create(
        {
          ...data,
          id,
          resourceId: user.id,
        },
      );

      const { data: trigger, error } = await db.from("deco_chat_triggers")
        .insert({
          id,
          agent_id: agentId,
          user_id: user.id,
          workspace,
          metadata: data as Json,
        })
        .select(SELECT_TRIGGER_QUERY)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      const agents = await getAgentsByIds([agentId], c);
      const agentsById = agents.reduce((acc, agent) => {
        acc[agent.id] = agent;
        return acc;
      }, {} as Record<string, z.infer<typeof AgentSchema>>);

      return {
        success: true,
        message: "Trigger created successfully",
        trigger: mapTrigger(trigger, agentsById),
      };
    } catch (_) {
      return {
        success: false,
        message: "Failed to create trigger",
        trigger: null,
      };
    }
  },
});

export const createCronTrigger = createApiHandler({
  name: "TRIGGERS_CREATE_CRON",
  description: "Create a cron trigger",
  schema: z.object({ agentId: z.string(), data: CreateCronTriggerInputSchema }),
  handler: async (
    { agentId, data },
    c,
  ): Promise<z.infer<typeof CreateTriggerOutputSchema>> => {
    assertHasWorkspace(c);
    const db = c.db;
    const workspace = c.workspace.value;
    const user = c.user;
    const stub = c.stub;

    await assertUserHasAccessToWorkspace(c);

    const id = crypto.randomUUID();

    const triggerId = Path.resolveHome(
      join(Path.folders.Agent.root(agentId), Path.folders.trigger(id)),
      workspace,
    ).path;

    try {
      await stub(Trigger).new(triggerId).create(
        {
          ...data,
          id,
          resourceId: user.id,
        },
      );

      const { data: trigger, error } = await db.from("deco_chat_triggers")
        .insert({
          id,
          agent_id: agentId,
          user_id: user.id,
          workspace,
          metadata: data as Json,
        })
        .select(SELECT_TRIGGER_QUERY)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      const agents = await getAgentsByIds([agentId], c);
      const agentsById = agents.reduce((acc, agent) => {
        acc[agent.id] = agent;
        return acc;
      }, {} as Record<string, z.infer<typeof AgentSchema>>);

      return {
        success: true,
        message: "Trigger created successfully",
        trigger: mapTrigger(trigger, agentsById),
      };
    } catch (_) {
      return {
        success: false,
        message: "Failed to create trigger",
        trigger: null,
      };
    }
  },
});

export const createWebhookTrigger = createApiHandler({
  name: "TRIGGERS_CREATE_WEBHOOK",
  description: "Create a webhook trigger",
  schema: z.object({
    agentId: z.string(),
    data: CreateWebhookTriggerInputSchema,
  }),
  handler: async (
    { agentId, data },
    c,
  ): Promise<z.infer<typeof CreateTriggerOutputSchema>> => {
    assertHasWorkspace(c);
    const db = c.db;
    const workspace = c.workspace.value;
    const user = c.user;
    const stub = c.stub;

    await assertUserHasAccessToWorkspace(c);

    const id = crypto.randomUUID();

    const triggerId = Path.resolveHome(
      join(Path.folders.Agent.root(agentId), Path.folders.trigger(id)),
      workspace,
    ).path;

    (data as z.infer<typeof TriggerSchema> & { url: string }).url =
      buildWebhookUrl(triggerId, data.passphrase);

    try {
      await stub(Trigger).new(triggerId).create(
        {
          ...data,
          id,
          resourceId: user.id,
        },
      );

      const { data: trigger, error } = await db.from("deco_chat_triggers")
        .insert({
          id,
          agent_id: agentId,
          user_id: user.id,
          workspace,
          metadata: data as Json,
        })
        .select(SELECT_TRIGGER_QUERY)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      const agents = await getAgentsByIds([agentId], c);
      const agentsById = agents.reduce((acc, agent) => {
        acc[agent.id] = agent;
        return acc;
      }, {} as Record<string, z.infer<typeof AgentSchema>>);

      return {
        success: true,
        message: "Trigger created successfully",
        trigger: mapTrigger(trigger, agentsById),
      };
    } catch (_) {
      return {
        success: false,
        message: "Failed to create trigger",
        trigger: null,
      };
    }
  },
});
export const deleteTrigger = createApiHandler({
  name: "TRIGGERS_DELETE",
  description: "Delete a trigger",
  schema: z.object({ triggerId: z.string(), agentId: z.string() }),
  handler: async (
    { triggerId, agentId },
    c,
  ): Promise<z.infer<typeof DeleteTriggerOutputSchema>> => {
    assertHasWorkspace(c);
    const db = c.db;
    const workspace = c.workspace.value;
    const stub = c.stub;

    await assertUserHasAccessToWorkspace(c);

    const workspaceTrigger = Path.resolveHome(
      join(Path.folders.Agent.root(agentId), Path.folders.trigger(triggerId)),
      workspace,
    ).path;

    try {
      await stub(Trigger).new(workspaceTrigger).delete();

      const { error } = await db.from("deco_chat_triggers")
        .delete()
        .eq("id", triggerId)
        .eq("workspace", workspace);

      if (error) {
        return {
          success: false,
          message: "Failed to delete trigger",
        };
      }

      return {
        success: true,
        message: "Trigger deleted successfully",
      };
    } catch (_) {
      return {
        success: false,
        message: "Failed to delete trigger",
      };
    }
  },
});

export const getWebhookTriggerUrl = createApiHandler({
  name: "TRIGGERS_GET_WEBHOOK_URL",
  description: "Get the webhook URL for a trigger",
  schema: z.object({ triggerId: z.string() }),
  handler: async (
    { triggerId },
    c,
  ): Promise<z.infer<typeof GetWebhookTriggerUrlOutputSchema>> => {
    assertHasWorkspace(c);
    const db = c.db;
    const workspace = c.workspace.value;

    await assertUserHasAccessToWorkspace(c);

    const { data, error } = await db.from("deco_chat_triggers")
      .select("metadata")
      .eq("id", triggerId)
      .eq("workspace", workspace)
      .single();

    if (error) {
      return {
        success: false,
        message: "Failed to get webhook trigger URL",
      };
    }

    if (!data) {
      return {
        success: false,
        message: "Trigger not found",
      };
    }

    return {
      success: true,
      message: "Webhook trigger URL retrieved successfully",
      url: (data.metadata as { url?: string })?.url,
    };
  },
});

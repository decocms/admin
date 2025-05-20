import { Trigger } from "@deco/ai/actors";
import { join } from "node:path";
import { z } from "zod";
import {
  InternalServerError,
  NotFoundError,
  UserInputError,
} from "../../errors.ts";
import { Hosts } from "../../hosts.ts";
import { AgentSchema } from "../../models/agent.ts";
import {
  CreateCronTriggerInputSchema,
  CreateTriggerOutputSchema,
  CreateWebhookTriggerInputSchema,
  DeleteTriggerOutputSchema,
  GetWebhookTriggerUrlOutputSchema,
  ListTriggersOutputSchema,
  TriggerSchema,
} from "../../models/trigger.ts";
import { Path } from "../../path.ts";
import { Database, Json } from "../../storage/index.ts";
import { getAgentsByIds } from "../agents/api.ts";
import {
  assertHasWorkspace,
  canAccessWorkspaceResource,
} from "../assertions.ts";
import { createApiHandler } from "../context.ts";
import { userFromDatabase } from "../user.ts";

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
    type: trigger.metadata && typeof trigger.metadata === "object" &&
        "cronExp" in trigger.metadata
      ? "cron" as const
      : "webhook" as const,
    id: trigger.id,
    agent: agentsById[trigger.agent_id],
    createdAt: trigger.created_at,
    updatedAt: trigger.updated_at,
    user: {
      // @ts-expect-error - Supabase user metadata is not typed
      ...userFromDatabase(trigger.profile),
      id: trigger.user_id,
      // @ts-expect-error - Supabase user metadata is not typed
    } as z.infer<typeof ListTriggersOutputSchema["triggers"][number]["user"]>,
    workspace: trigger.workspace,
    active: trigger.active,
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
  async canAccess(_, c) {
    return await canAccessWorkspaceResource(this.name, c);
  },
  handler: async (
    { agentId },
    c,
  ): Promise<z.infer<typeof ListTriggersOutputSchema>> => {
    assertHasWorkspace(c);
    const db = c.db;
    const workspace = c.workspace.value;

    const query = db
      .from("deco_chat_triggers")
      .select(SELECT_TRIGGER_QUERY)
      .eq("workspace", workspace);

    if (agentId) {
      query.eq("agent_id", agentId);
    }

    const { data, error } = await query;

    if (error) {
      throw new InternalServerError(error.message);
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
      triggers: data.map((trigger) => mapTrigger(trigger, agentsById)),
    };
  },
});

export const createTrigger = createApiHandler({
  name: "TRIGGERS_CREATE",
  description: "Create a trigger",
  schema: z.object({ agentId: z.string(), data: TriggerSchema }),
  async canAccess(_, c) {
    return await canAccessWorkspaceResource(this.name, c);
  },
  handler: async (
    { agentId, data },
    c,
  ): Promise<z.infer<typeof CreateTriggerOutputSchema>> => {
    assertHasWorkspace(c);
    const db = c.db;
    const workspace = c.workspace.value;
    const user = c.user;
    const stub = c.stub;

    // Check if there's already a WhatsApp-enabled trigger for this agent
    const whatsappEnabled =
      (data as z.infer<typeof TriggerSchema> & { whatsappEnabled: boolean })
        .whatsappEnabled;
    if (whatsappEnabled) {
      const { data: _existingTriggers, error: checkError } = await db.from(
        "deco_chat_triggers",
      )
        .select("id")
        .eq("agent_id", agentId)
        .eq("workspace", workspace)
        .eq("whatsapp_enabled", true);

      if (checkError) {
        throw new InternalServerError(checkError.message);
      }
    }

    const id = crypto.randomUUID();

    const triggerId = Path.resolveHome(
      join(Path.folders.Agent.root(agentId), Path.folders.trigger(id)),
      workspace,
    ).path;

    if (data.type === "cron") {
      const parse = CreateCronTriggerInputSchema.safeParse(data);
      if (!parse.success) {
        throw new UserInputError("Invalid trigger");
      }
    }

    if (data.type === "webhook") {
      const parse = CreateWebhookTriggerInputSchema.safeParse(data);
      if (!parse.success) {
        throw new UserInputError("Invalid trigger");
      }
      (data as z.infer<typeof TriggerSchema> & { url: string }).url =
        buildWebhookUrl(triggerId, data.passphrase);
    }

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
        whatsapp_enabled:
          (data as z.infer<typeof TriggerSchema> & { whatsappEnabled: boolean })
            .whatsappEnabled,
      })
      .select(SELECT_TRIGGER_QUERY)
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    const agents = await getAgentsByIds([agentId], c);
    const agentsById = agents.reduce((acc, agent) => {
      acc[agent.id] = agent;
      return acc;
    }, {} as Record<string, z.infer<typeof AgentSchema>>);

    return mapTrigger(trigger, agentsById);
  },
});

export const createCronTrigger = createApiHandler({
  name: "TRIGGERS_CREATE_CRON",
  description: "Create a cron trigger",
  schema: z.object({ agentId: z.string(), data: CreateCronTriggerInputSchema }),
  async canAccess(_, c) {
    return await canAccessWorkspaceResource(this.name, c);
  },
  handler: async (
    { agentId, data },
    c,
  ): Promise<z.infer<typeof CreateTriggerOutputSchema>> => {
    assertHasWorkspace(c);
    const db = c.db;
    const workspace = c.workspace.value;
    const user = c.user;
    const stub = c.stub;

    const id = crypto.randomUUID();

    const triggerId = Path.resolveHome(
      join(Path.folders.Agent.root(agentId), Path.folders.trigger(id)),
      workspace,
    ).path;

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
      throw new InternalServerError(error.message);
    }

    const agents = await getAgentsByIds([agentId], c);
    const agentsById = agents.reduce((acc, agent) => {
      acc[agent.id] = agent;
      return acc;
    }, {} as Record<string, z.infer<typeof AgentSchema>>);

    return mapTrigger(trigger, agentsById);
  },
});

export const createWebhookTrigger = createApiHandler({
  name: "TRIGGERS_CREATE_WEBHOOK",
  description: "Create a webhook trigger",
  schema: z.object({
    agentId: z.string(),
    data: CreateWebhookTriggerInputSchema,
  }),
  async canAccess(_, c) {
    return await canAccessWorkspaceResource(this.name, c);
  },
  handler: async (
    { agentId, data },
    c,
  ): Promise<z.infer<typeof CreateTriggerOutputSchema>> => {
    assertHasWorkspace(c);
    const db = c.db;
    const workspace = c.workspace.value;
    const user = c.user;
    const stub = c.stub;

    const id = crypto.randomUUID();

    const triggerId = Path.resolveHome(
      join(Path.folders.Agent.root(agentId), Path.folders.trigger(id)),
      workspace,
    ).path;

    (data as z.infer<typeof TriggerSchema> & { url: string }).url =
      buildWebhookUrl(triggerId, data.passphrase);

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
        whatsapp_enabled:
          (data as z.infer<typeof TriggerSchema> & { whatsappEnabled: boolean })
            .whatsappEnabled,
      })
      .select(SELECT_TRIGGER_QUERY)
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    const agents = await getAgentsByIds([agentId], c);
    const agentsById = agents.reduce((acc, agent) => {
      acc[agent.id] = agent;
      return acc;
    }, {} as Record<string, z.infer<typeof AgentSchema>>);

    return mapTrigger(trigger, agentsById);
  },
});
export const deleteTrigger = createApiHandler({
  name: "TRIGGERS_DELETE",
  description: "Delete a trigger",
  schema: z.object({ triggerId: z.string(), agentId: z.string() }),
  async canAccess(_, c) {
    return await canAccessWorkspaceResource(this.name, c);
  },
  handler: async (
    { triggerId, agentId },
    c,
  ): Promise<z.infer<typeof DeleteTriggerOutputSchema>> => {
    assertHasWorkspace(c);
    const db = c.db;
    const workspace = c.workspace.value;
    const stub = c.stub;

    const workspaceTrigger = Path.resolveHome(
      join(Path.folders.Agent.root(agentId), Path.folders.trigger(triggerId)),
      workspace,
    ).path;

    await stub(Trigger).new(workspaceTrigger).delete();

    const { error } = await db.from("deco_chat_triggers")
      .delete()
      .eq("id", triggerId)
      .eq("workspace", workspace);

    if (error) {
      throw new InternalServerError(error.message);
    }
  },
});

export const getWebhookTriggerUrl = createApiHandler({
  name: "TRIGGERS_GET_WEBHOOK_URL",
  description: "Get the webhook URL for a trigger",
  schema: z.object({ triggerId: z.string() }),
  async canAccess(_, c) {
    return await canAccessWorkspaceResource(this.name, c);
  },
  handler: async (
    { triggerId },
    c,
  ): Promise<z.infer<typeof GetWebhookTriggerUrlOutputSchema>> => {
    assertHasWorkspace(c);
    const db = c.db;
    const workspace = c.workspace.value;

    const { data, error } = await db.from("deco_chat_triggers")
      .select("metadata")
      .eq("id", triggerId)
      .eq("workspace", workspace)
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    if (!data) {
      throw new NotFoundError("Trigger not found");
    }

    return {
      url: (data.metadata as { url?: string })?.url,
    };
  },
});

export const getTrigger = createApiHandler({
  name: "TRIGGERS_GET",
  description: "Get a trigger by ID",
  schema: z.object({ id: z.string() }),
  async canAccess(_, c) {
    return await canAccessWorkspaceResource(this.name, c);
  },
  handler: async (
    { id: triggerId },
    c,
  ): Promise<z.infer<typeof CreateTriggerOutputSchema> | null> => {
    assertHasWorkspace(c);
    const db = c.db;
    const workspace = c.workspace.value;

    const { data: trigger, error } = await db.from("deco_chat_triggers")
      .select(SELECT_TRIGGER_QUERY)
      .eq("id", triggerId)
      .eq("workspace", workspace)
      .maybeSingle();

    if (error) {
      throw new InternalServerError(error.message);
    }

    if (!trigger) {
      return null;
    }

    const agents = await getAgentsByIds([trigger.agent_id], c);
    const agentsById = agents.reduce((acc, agent) => {
      acc[agent.id] = agent;
      return acc;
    }, {} as Record<string, z.infer<typeof AgentSchema>>);

    return mapTrigger(trigger, agentsById);
  },
});

export const activateTrigger = createApiHandler({
  name: "TRIGGERS_ACTIVATE",
  description: "Activate a trigger",
  schema: z.object({ triggerId: z.string() }),
  async canAccess(_, c) {
    return await canAccessWorkspaceResource(this.name, c);
  },
  handler: async ({ triggerId }, c) => {
    assertHasWorkspace(c);
    const db = c.db;
    const workspace = c.workspace.value;
    const stub = c.stub;
    const user = c.user;

    try {
      const { data, error: selectError } = await db.from("deco_chat_triggers")
        .select("*")
        .eq("id", triggerId)
        .eq("workspace", workspace)
        .single();

      if (selectError) {
        return {
          success: false,
          message: "Failed to activate trigger",
        };
      }

      if (data?.active) {
        return {
          success: true,
          message: "Trigger already activated",
        };
      }

      await stub(Trigger).new(triggerId).create(
        {
          ...data.metadata as z.infer<typeof TriggerSchema>,
          id: data.id,
          resourceId: user.id,
        },
      );

      const { error } = await db.from("deco_chat_triggers")
        .update({ active: true })
        .eq("id", triggerId)
        .eq("workspace", workspace);

      if (error) {
        return {
          success: false,
          message: "Failed to activate trigger",
        };
      }

      return {
        success: true,
        message: "Trigger activated successfully",
      };
    } catch (_) {
      return {
        success: false,
        message: "Failed to activate trigger",
      };
    }
  },
});

export const deactivateTrigger = createApiHandler({
  name: "TRIGGERS_DEACTIVATE",
  description: "Deactivate a trigger",
  schema: z.object({ triggerId: z.string() }),
  async canAccess(_, c) {
    return await canAccessWorkspaceResource(this.name, c);
  },
  handler: async ({ triggerId }, c) => {
    assertHasWorkspace(c);
    const db = c.db;
    const workspace = c.workspace.value;
    const stub = c.stub;

    try {
      const { data, error: selectError } = await db.from("deco_chat_triggers")
        .select("*")
        .eq("id", triggerId)
        .eq("workspace", workspace)
        .single();

      if (selectError) {
        return {
          success: false,
          message: "Failed to deactivate trigger",
        };
      }

      if (!data?.active) {
        return {
          success: true,
          message: "Trigger already deactivated",
        };
      }

      await stub(Trigger).new(triggerId).delete();

      const { error } = await db.from("deco_chat_triggers")
        .update({ active: false })
        .eq("id", triggerId)
        .eq("workspace", workspace);

      if (error) {
        return {
          success: false,
          message: "Failed to deactivate trigger",
        };
      }

      return {
        success: true,
        message: "Trigger deactivated successfully",
      };
    } catch (_) {
      return {
        success: false,
        message: "Failed to deactivate trigger",
      };
    }
  },
});

import { createApiHandler } from "../../utils/context.ts";
import { z } from "zod";
import { assertUserHasAccessToWorkspace } from "../../auth/assertions.ts";
import { getAgentsByIds } from "../agents/api.ts";
import { AgentSchema, CreateCronTriggerInputSchema, CreateTriggerOutputSchema, CreateWebhookTriggerInputSchema, ListTriggersOutputSchema, TriggerSchema } from "@deco/sdk";
import { userFromDatabase } from "../../utils/user.ts";
import { Database, Json } from "@deco/sdk/storage";
import { Trigger } from "@deco/ai/actors";
import { Path } from "@deco/sdk/path";
import { join } from "node:path";

const SELECT_TRIGGER_QUERY = `
  *, 
  profile:profiles(
    metadata:users_meta_data_view(
      raw_user_meta_data
    )
  )
`;

function mapTrigger(trigger: Database["public"]["Tables"]["deco_chat_triggers"]["Row"], agentsById: Record<string, z.infer<typeof AgentSchema>>) {
  return {
    id: trigger.id,
    agent: agentsById[trigger.agent_id],
    created_at: trigger.created_at,
    updated_at: trigger.updated_at,
    // @ts-expect-error - Supabase user metadata is not typed
    user: {...userFromDatabase(trigger.profile), id: trigger.user_id } as z.infer<typeof ListTriggersOutputSchema["triggers"][number]["user"]>,
    workspace: trigger.workspace,
    data: trigger.metadata as z.infer<typeof TriggerSchema>,
  };
}

export const listTriggers = createApiHandler({
  name: "TRIGGERS_LIST",
  description: "List all triggers",
  schema: z.object({ agentId: z.string().optional() }),
  handler: async ({ agentId }, c): Promise<z.infer<typeof ListTriggersOutputSchema>> => {
    const db = c.get("db");
    const root = c.req.param("root");
    const slug = c.req.param("slug");
    const workspace = `/${root}/${slug}`;
    
    await assertUserHasAccessToWorkspace(root, slug, c);

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

    const agents = await getAgentsByIds(agentIds, workspace, c);

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
  handler: async ({ agentId, data }, c): Promise<z.infer<typeof CreateTriggerOutputSchema>> => {
    const db = c.get("db");
    const root = c.req.param("root");
    const slug = c.req.param("slug");
    const workspace = `/${root}/${slug}`;
    const user = c.get("user");
    const stub = c.get("stub");

    await assertUserHasAccessToWorkspace(root, slug, c);

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
    }

    try {

      const id = crypto.randomUUID();

      const triggerId = Path.resolveHome(
        join(Path.folders.Agent.root(agentId), Path.folders.trigger(id)),
        workspace,
      ).path;
      console.log("triggerId", triggerId);
      await stub(Trigger).new(triggerId).create(
        {
          ...data,
          id, 
          resourceId: user.id,
        },
        agentId,
        user.id,
      );
      console.log("stub passed");
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
  
      const agents = await getAgentsByIds([agentId], workspace, c);
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
      console.log("ERROR", _);
      return {
        success: false,
        message: "Failed to create trigger",
        trigger: null,
      };
    }
  },
});


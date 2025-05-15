import { type Agent, AgentSchema, WELL_KNOWN_AGENTS } from "@deco/sdk";
import { hasAccessToPath } from "@deco/sdk/auth";
import type { Workspace } from "@deco/sdk/path";
import type { Client, Database, Json } from "@deco/sdk/storage";
import type { AuthUser } from "@supabase/supabase-js";
import type z from "zod";
import type {
  PromptSchema,
  TriggerData,
  TriggerRun,
} from "../triggers/services.ts";
import { AgentNotFoundError, TriggerNotFoundError } from "./error.ts";
import type { DecoChatStorage, TriggersStorage } from "./index.ts";

type UserMetadata = {
  iss?: string;
  sub?: string;
  name?: string;
  email?: string;
  picture?: string;
  full_name?: string;
  avatar_url?: string;
  provider_id?: string;
  custom_claims?: { hd?: string };
  email_verified?: boolean;
  phone_verified?: boolean;
};

const readAgent = async ({
  id,
  workspace,
  supabase,
}: {
  id: string;
  workspace: Workspace;
  supabase: Client;
}): Promise<Agent> => {
  try {
    if (id in WELL_KNOWN_AGENTS) {
      return AgentSchema.parse(
        WELL_KNOWN_AGENTS[id as keyof typeof WELL_KNOWN_AGENTS],
      );
    }

    const { data, error } = await supabase
      .from("deco_chat_agents")
      .select("*")
      .eq("id", id)
      .eq("workspace", workspace)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new AgentNotFoundError("Agent not found");
    }

    return AgentSchema.parse(data);
  } catch (error) {
    throw error;
  }
};

const getAgentsByIds = async ({
  ids,
  workspace,
  supabase,
}: {
  ids: string[];
  workspace: Workspace;
  supabase: Client;
}): Promise<Agent[]> => {
  if (ids.length === 0) return [];

  const dbIds = ids.filter((id) => !(id in WELL_KNOWN_AGENTS));

  let dbAgents: Agent[] = [];
  if (dbIds.length > 0) {
    const { data, error } = await supabase
      .from("deco_chat_agents")
      .select("*")
      .in("id", dbIds)
      .eq("workspace", workspace);

    if (error) {
      throw error;
    }

    dbAgents = data.map((item) => AgentSchema.parse(item));
  }

  return ids
    .map((id) => {
      if (id in WELL_KNOWN_AGENTS) {
        return AgentSchema.parse(
          WELL_KNOWN_AGENTS[id as keyof typeof WELL_KNOWN_AGENTS],
        );
      }
      return dbAgents.find((agent) => agent.id === id);
    })
    .filter((a): a is Agent => !!a);
};

const SELECT_TRIGGER_QUERY = `
  *, 
  profile:profiles(
    metadata:users_meta_data_view(
      raw_user_meta_data
    )
  )
`;
const mapTriggerToTriggerData = (
  trigger: Database["public"]["Tables"]["deco_chat_triggers"]["Row"] & {
    profile?: {
      metadata: {
        raw_user_meta_data: Json;
      };
    } | null;
  },
): TriggerData & { url?: string } => {
  const metadata = (trigger.metadata ?? {}) as Record<string, unknown>;
  const userMetadata = trigger.profile?.metadata?.raw_user_meta_data as
    | UserMetadata
    | undefined;

  return {
    id: trigger.id,
    type: metadata.type as "cron" | "webhook",
    title: metadata.title as string,
    description: metadata.description as string,
    cron_exp: metadata.cron_exp as string,
    prompt: metadata.prompt as z.infer<typeof PromptSchema>,
    url: metadata.url as string,
    passphrase: metadata.passphrase as string,
    schema: metadata.schema as Record<string, unknown>,
    createdAt: trigger.created_at,
    updatedAt: trigger.updated_at,
    author: userMetadata
      ? {
        id: trigger?.user_id ?? "",
        name: userMetadata.name ?? "",
        email: userMetadata.email ?? "",
        avatar: userMetadata.avatar_url ?? "",
      }
      : undefined,
  };
};

const listTriggers = async ({
  workspace,
  supabase,
  agentId,
}: {
  workspace: Workspace;
  supabase: Client;
  agentId?: string;
}): Promise<TriggerData[]> => {
  const query = supabase
    .from("deco_chat_triggers")
    .select(SELECT_TRIGGER_QUERY)
    .eq("workspace", workspace);

  if (agentId) {
    query.eq("agent_id", agentId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const agentIds = Array.from(
    new Set(data.map((trigger) => trigger.agent_id).filter(Boolean)),
  );

  const agents = await getAgentsByIds({ ids: agentIds, workspace, supabase });
  const agentsById = agents.reduce((acc, agent) => {
    acc[agent.id] = agent;
    return acc;
  }, {} as Record<string, Agent>);

  return data.map((trigger) => ({
    ...mapTriggerToTriggerData(trigger),
    agent: agentsById[String(trigger.agent_id)] ?? undefined,
  }));
};

const readTrigger = async ({
  id,
  workspace,
  supabase,
}: {
  id: string;
  workspace: Workspace;
  supabase: Client;
}): Promise<TriggerData> => {
  const { data, error } = await supabase
    .from("deco_chat_triggers")
    .select(SELECT_TRIGGER_QUERY)
    .eq("id", id)
    .eq("workspace", workspace)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new TriggerNotFoundError("Trigger not found");
  }

  const agent = await readAgent({ id: data.agent_id, workspace, supabase });
  return { ...mapTriggerToTriggerData(data), agent };
};

const createTrigger = async ({
  trigger,
  agentId,
  workspace,
  supabase,
  userId,
}: {
  trigger: TriggerData & { url?: string };
  agentId: string;
  workspace: Workspace;
  supabase: Client;
  userId: string;
}): Promise<TriggerData> => {
  const isWebhook = trigger.type === "webhook";
  const isCron = trigger.type === "cron";
  const { data, error } = await supabase
    .from("deco_chat_triggers")
    .insert({
      id: trigger.id || crypto.randomUUID(),
      agent_id: agentId,
      workspace: workspace,
      metadata: {
        type: trigger.type,
        title: trigger.title,
        description: trigger.description || null,
        cron_exp: isCron ? trigger.cron_exp : null,
        prompt: isCron ? trigger.prompt : null,
        url: isWebhook ? trigger.url : null,
        passphrase: isWebhook ? trigger.passphrase : null,
        schema: isWebhook ? trigger.schema : null,
      } as Json,
      user_id: userId,
    })
    .select(SELECT_TRIGGER_QUERY)
    .single();

  if (error) {
    throw error;
  }

  return mapTriggerToTriggerData(data);
};

const deleteTrigger = async ({
  id,
  workspace,
  supabase,
}: {
  id: string;
  workspace: Workspace;
  supabase: Client;
}): Promise<void> => {
  try {
    const { error } = await supabase
      .from("deco_chat_triggers")
      .delete()
      .eq("id", id)
      .eq("workspace", workspace);

    if (error) {
      throw error;
    }
  } catch (error) {
    throw error;
  }
};

const listTriggerRuns = async ({
  id,
  supabase,
}: {
  id: string;
  supabase: Client;
}): Promise<TriggerRun[]> => {
  const { data, error } = await supabase
    .from("deco_chat_trigger_runs")
    .select("*")
    .eq("trigger_id", id);

  if (error) {
    throw error;
  }

  return data.map((run) => ({
    id: run.id,
    triggerId: run.trigger_id,
    timestamp: run.timestamp,
    result: run.result as Record<string, unknown>,
    status: run.status,
    metadata: run.metadata as Record<string, unknown>,
  }));
};

const createTriggerRun = async ({
  run,
  supabase,
}: {
  run: Omit<TriggerRun, "id" | "timestamp">;
  supabase: Client;
}): Promise<TriggerRun> => {
  const { data, error } = await supabase
    .from("deco_chat_trigger_runs")
    .insert({
      trigger_id: run.triggerId,
      result: run.result as Json,
      metadata: run.metadata as Json,
      status: run.status,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw error || new Error("Failed to create trigger run data");
  }

  return {
    id: data.id,
    triggerId: data.trigger_id,
    result: data.result as Record<string, unknown>,
    status: data.status,
    metadata: data.metadata as Record<string, unknown>,
    timestamp: data.timestamp,
  };
};

export const createSupabaseStorage = (
  supabase: Client,
  user?: AuthUser,
): DecoChatStorage => {
  const auth = (workspace: Workspace, user: AuthUser) => {
    if (!hasAccessToPath(user, workspace)) {
      throw new Error("Unauthorized");
    }
  };

  const triggers: TriggersStorage = {
    for: (workspace) => {
      if (user && workspace) {
        auth(workspace, user);
      }

      return {
        list: (agentId?: string) =>
          listTriggers({ workspace, supabase, agentId }),
        get: (id: string) => readTrigger({ id, workspace, supabase }),
        create: (
          trigger: TriggerData & { url?: string },
          agentId: string,
          userId: string,
        ) => createTrigger({ trigger, agentId, workspace, supabase, userId }),
        delete: (id: string) => deleteTrigger({ id, workspace, supabase }),
        run: (run: Omit<TriggerRun, "id" | "timestamp">) =>
          createTriggerRun({ run, supabase }),
        listRuns: (id: string) => listTriggerRuns({ id, supabase }),
      };
    },
  };

  return { triggers };
};

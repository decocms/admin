import { z } from "zod";
import {
  AgentNotFoundError,
  AgentSchema,
  NEW_AGENT_TEMPLATE,
  WELL_KNOWN_AGENTS,
} from "../../index.ts";
import {
  assertHasWorkspace,
  assertUserHasAccessToWorkspace,
} from "../assertions.ts";
import { AppContext, createApiHandler } from "../context.ts";
import { InternalServerError, NotFoundError } from "../index.ts";
import { PostgrestError } from "@supabase/supabase-js";

const NO_DATA_ERROR = "PGRST116";

export const getAgentsByIds = async (
  ids: string[],
  c: AppContext,
) => {
  assertHasWorkspace(c);

  if (ids.length === 0) return [];

  const dbIds = ids.filter((id) => !(id in WELL_KNOWN_AGENTS));

  let dbAgents: z.infer<typeof AgentSchema>[] = [];
  if (dbIds.length > 0) {
    const { data, error } = await c.db
      .from("deco_chat_agents")
      .select("*")
      .in("id", dbIds)
      .eq("workspace", c.workspace.value);

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
    .filter((a): a is z.infer<typeof AgentSchema> => !!a);
};

export const listAgents = createApiHandler({
  name: "AGENTS_LIST",
  description: "List all agents",
  schema: z.object({}),
  handler: async (_, c) => {
    assertHasWorkspace(c);

    const [
      _assertions,
      { data, error },
    ] = await Promise.all([
      assertUserHasAccessToWorkspace(c),
      c.db
        .from("deco_chat_agents")
        .select("*")
        .ilike("workspace", c.workspace.value),
    ]);

    if (error) {
      throw new InternalServerError(error.message);
    }

    return data
      .map((item) => AgentSchema.safeParse(item)?.data)
      .filter((a) => !!a);
  },
});

export const getAgent = createApiHandler({
  name: "AGENTS_GET",
  description: "Get an agent by id",
  schema: z.object({ id: z.string() }),
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);

    const [
      hasAccessToWorkspace,
      { data, error },
    ] = await Promise.all([
      assertUserHasAccessToWorkspace(c)
        .then(() => true).catch((e) => e),
      id in WELL_KNOWN_AGENTS
        ? {
          data: WELL_KNOWN_AGENTS[id as keyof typeof WELL_KNOWN_AGENTS],
          error: null,
        }
        : c.db
          .from("deco_chat_agents")
          .select("*")
          .eq("id", id)
          .single(),
    ]);

    if (hasAccessToWorkspace !== true && data?.visibility !== "PUBLIC") {
      throw hasAccessToWorkspace;
    }

    if ((error && error.code == NO_DATA_ERROR) || !data) {
      throw new AgentNotFoundError(id);
    }

    if (error) {
      throw new InternalServerError((error as PostgrestError).message);
    }

    return AgentSchema.parse(data);
  },
});

export const createAgent = createApiHandler({
  name: "AGENTS_CREATE",
  description: "Create a new agent",
  schema: AgentSchema.partial(),
  handler: async (agent, c) => {
    assertHasWorkspace(c);

    await assertUserHasAccessToWorkspace(c);

    const [{ data, error }] = await Promise.all([
      c.db
        .from("deco_chat_agents")
        .insert({
          ...NEW_AGENT_TEMPLATE,
          ...agent,
          workspace: c.workspace.value,
        })
        .select()
        .single(),
    ]);

    if (error) {
      throw new InternalServerError(error.message);
    }

    return AgentSchema.parse(data);
  },
});

export const updateAgent = createApiHandler({
  name: "AGENTS_UPDATE",
  description: "Update an existing agent",
  schema: z.object({
    id: z.string(),
    agent: AgentSchema.partial(),
  }),
  handler: async ({ id, agent }, c) => {
    assertHasWorkspace(c);

    await assertUserHasAccessToWorkspace(c);

    const { data, error } = await c.db
      .from("deco_chat_agents")
      .update({ ...agent, id, workspace: c.workspace.value })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    if (!data) {
      throw new NotFoundError("Agent not found");
    }

    return AgentSchema.parse(data);
  },
});

export const deleteAgent = createApiHandler({
  name: "AGENTS_DELETE",
  description: "Delete an agent by id",
  schema: z.object({ id: z.string() }),
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);

    await assertUserHasAccessToWorkspace(c);

    const { error } = await c.db
      .from("deco_chat_agents")
      .delete()
      .eq("id", id);

    if (error) {
      throw new InternalServerError(error.message);
    }

    return true;
  },
});

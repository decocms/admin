import { AgentSchema, NEW_AGENT_TEMPLATE, WELL_KNOWN_AGENTS } from "@deco/sdk";
import { z } from "zod";
import { assertUserHasAccessToWorkspace } from "../../auth/assertions.ts";
import { AppContext, createApiHandler } from "../../utils/context.ts";

export const getAgentsByIds = async (ids: string[], workspace: string, c: AppContext) => {
  if (ids.length === 0) return [];

  const dbIds = ids.filter((id) => !(id in WELL_KNOWN_AGENTS));

  let dbAgents: z.infer<typeof AgentSchema>[] = [];
  if (dbIds.length > 0) {
    const { data, error } = await c.get("db")
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
        return AgentSchema.parse(WELL_KNOWN_AGENTS[id as keyof typeof WELL_KNOWN_AGENTS]);
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
    const root = c.req.param("root");
    const slug = c.req.param("slug");

    const [
      _assertions,
      { data, error },
    ] = await Promise.all([
      assertUserHasAccessToWorkspace(root, slug, c),
      c.get("db")
        .from("deco_chat_agents")
        .select("*")
        .ilike("workspace", `%${root}/${slug}`),
    ]);

    if (error) {
      throw new Error(error.message);
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
    const root = c.req.param("root");
    const slug = c.req.param("slug");

    const [
      _assertions,
      { data, error },
    ] = await Promise.all([
      assertUserHasAccessToWorkspace(root, slug, c),
      id in WELL_KNOWN_AGENTS
        ? {
          data: WELL_KNOWN_AGENTS[id as keyof typeof WELL_KNOWN_AGENTS],
          error: null,
        }
        : c.get("db")
          .from("deco_chat_agents")
          .select("*")
          .eq("id", id)
          .single(),
    ]);

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error("Agent not found");
    }

    return AgentSchema.parse(data);
  },
});

export const createAgent = createApiHandler({
  name: "AGENTS_CREATE",
  description: "Create a new agent",
  schema: AgentSchema.partial(),
  handler: async (agent, c) => {
    const root = c.req.param("root");
    const slug = c.req.param("slug");

    await assertUserHasAccessToWorkspace(root, slug, c);

    const [{ data, error }] = await Promise.all([
      c.get("db")
        .from("deco_chat_agents")
        .insert({
          ...NEW_AGENT_TEMPLATE,
          ...agent,
          workspace: `/${root}/${slug}`,
        })
        .select()
        .single(),
    ]);

    if (error) {
      throw new Error(error.message);
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
    const root = c.req.param("root");
    const slug = c.req.param("slug");

    await assertUserHasAccessToWorkspace(root, slug, c);

    const { data, error } = await c.get("db")
      .from("deco_chat_agents")
      .update({ ...agent, id, workspace: `/${root}/${slug}` })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error("Agent not found");
    }

    return AgentSchema.parse(data);
  },
});

export const deleteAgent = createApiHandler({
  name: "AGENTS_DELETE",
  description: "Delete an agent by id",
  schema: z.object({ id: z.string() }),
  handler: async ({ id }, c) => {
    const root = c.req.param("root");
    const slug = c.req.param("slug");

    await assertUserHasAccessToWorkspace(root, slug, c);

    const { error } = await c.get("db")
      .from("deco_chat_agents")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }

    return true;
  },
});

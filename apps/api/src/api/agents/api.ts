import { AgentSchema } from "@deco/sdk";
import { z } from "zod";
import { assertUserHasAccessToWorkspace } from "../../auth/assertions.ts";
import { createApiHandler } from "../../utils/context.ts";
import { NEW_AGENT_TEMPLATE, WELL_KNOWN_AGENTS } from "./well-known.ts";

export const getAgent = createApiHandler({
  name: "AGENTS_GET",
  description: "Get an agent by id",
  schema: z.object({ id: z.string() }),
  handler: async ({ id }, c) => {
    const root = c.req.param("root");
    const slug = c.req.param("slug");

    const assertions = assertUserHasAccessToWorkspace(root, slug, c);

    const [{ data, error }] = await Promise.all([
      id in WELL_KNOWN_AGENTS
        ? { data: WELL_KNOWN_AGENTS[id], error: null }
        : c.get("db")
          .from("deco_chat_agents")
          .select("*")
          .eq("id", id)
          .single(),
      assertions,
    ]);

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error("Agent not found");
    }

    return data;
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

    return data;
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

    return data;
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

export const listAgents = createApiHandler({
  name: "AGENTS_LIST",
  description: "List all agents",
  schema: z.object({}),
  handler: async (_, c) => {
    const root = c.req.param("root");
    const slug = c.req.param("slug");

    const assertions = assertUserHasAccessToWorkspace(root, slug, c);

    const [{ data, error }] = await Promise.all([
      c.get("db")
        .from("deco_chat_agents")
        .select("*")
        .ilike("workspace", `%${root}/${slug}`),
      assertions,
    ]);

    if (error) {
      throw new Error(error.message);
    }

    return data;
  },
});

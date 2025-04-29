import { Agent, AgentSchema, Integration, IntegrationSchema } from "@deco/sdk";
import { z } from "zod";
import { assertUserHasAccessToWorkspace } from "../../auth/assertions.ts";
import { createApiHandler } from "../../utils/context.ts";
import { INNATE_INTEGRATIONS, NEW_INTEGRATION_TEMPLATE } from "./well-known.ts";

const ensureStartingSlash = (path: string) =>
  path.startsWith("/") ? path : `/${path}`;

const parseId = (id: string) => {
  const [type, uuid] = id.split(":");

  return {
    type: (type || "i") as "i" | "a",
    uuid: uuid || id,
  };
};

const formatId = (type: "i" | "a", uuid: string) => `${type}:${uuid}`;

const agentAsIntegrationFor =
  (workspace: string) => (agent: Agent): Integration => ({
    id: formatId("a", agent.id),
    icon: agent.avatar,
    name: agent.name,
    description: agent.description,
    connection: {
      name: formatId("a", agent.id),
      type: "INNATE",
      workspace: ensureStartingSlash(workspace),
    },
  });

// API Functions
export const getIntegration = createApiHandler({
  name: "INTEGRATIONS_GET",
  description: "Get an integration by id",
  schema: z.object({
    id: z.string(),
  }),
  handler: async ({ id }, c) => {
    const root = c.req.param("root");
    const slug = c.req.param("slug");

    const assertions = assertUserHasAccessToWorkspace(root, slug, c);

    const { uuid, type } = parseId(id);

    const { data, error } = uuid in INNATE_INTEGRATIONS
      ? { data: INNATE_INTEGRATIONS[uuid] }
      : await c.get("db")
        .from(type === "i" ? "deco_chat_integrations" : "deco_chat_agents")
        .select("*")
        .eq("id", uuid)
        .single();

    await assertions;

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error("Integration not found");
    }

    return {
      ...data,
      id: formatId(type, data.id),
    };
  },
});

export const createIntegration = createApiHandler({
  name: "INTEGRATIONS_CREATE",
  description: "Create a new integration",
  schema: IntegrationSchema.partial(),
  handler: async (integration, c) => {
    const root = c.req.param("root");
    const slug = c.req.param("slug");

    const assertions = assertUserHasAccessToWorkspace(root, slug, c);

    const { data, error } = await c.get("db")
      .from("deco_chat_integrations")
      .insert({
        ...NEW_INTEGRATION_TEMPLATE,
        ...integration,
        workspace: `/${root}/${slug}`,
      })
      .select()
      .single();

    await assertions;

    if (error) {
      throw new Error(error.message);
    }

    return {
      ...data,
      id: formatId("i", data.id),
    };
  },
});

export const updateIntegration = createApiHandler({
  name: "INTEGRATIONS_UPDATE",
  description: "Update an existing integration",
  schema: z.object({
    id: z.string(),
    integration: IntegrationSchema,
  }),
  handler: async ({ id, integration }, c) => {
    const root = c.req.param("root");
    const slug = c.req.param("slug");

    const assertions = assertUserHasAccessToWorkspace(root, slug, c);

    const { uuid, type } = parseId(id);

    if (type === "a") {
      throw new Error("Cannot update an agent integration");
    }

    const { data, error } = await c.get("db")
      .from("deco_chat_integrations")
      .update({ ...integration, id: uuid, workspace: `/${root}/${slug}` })
      .eq("id", uuid)
      .select()
      .single();

    await assertions;

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error("Integration not found");
    }

    return {
      ...data,
      id: formatId(type, data.id),
    };
  },
});

export const deleteIntegration = createApiHandler({
  name: "INTEGRATIONS_DELETE",
  description: "Delete an integration by id",
  schema: z.object({
    id: z.string(),
  }),
  handler: async ({ id }, c) => {
    const root = c.req.param("root");
    const slug = c.req.param("slug");

    const assertions = assertUserHasAccessToWorkspace(root, slug, c);

    const { uuid, type } = parseId(id);

    if (type === "a") {
      throw new Error("Cannot delete an agent integration");
    }

    const { error } = await c.get("db")
      .from("deco_chat_integrations")
      .delete()
      .eq("id", uuid);

    await assertions;

    if (error) {
      throw new Error(error.message);
    }

    return true;
  },
});

export const listIntegrations = createApiHandler({
  name: "INTEGRATIONS_LIST",
  description: "List all integrations",
  schema: z.object({}),
  handler: async (_, c) => {
    const root = c.req.param("root");
    const slug = c.req.param("slug");

    const assertions = assertUserHasAccessToWorkspace(root, slug, c);

    const [integrations, agents] = await Promise.all([
      c.get("db")
        .from("deco_chat_integrations")
        .select("*")
        .ilike("workspace", `%${root}/${slug}`),
      c.get("db")
        .from("deco_chat_agents")
        .select("*")
        .ilike("workspace", `%${root}/${slug}`),
    ]);

    await assertions;

    const error = integrations.error || agents.error;

    if (error) {
      throw new Error(error.message || "Failed to list integrations");
    }

    return [
      ...integrations.data.map((item) => ({
        ...item,
        id: formatId("i", item.id),
      })),
      ...agents.data
        .map((item) => AgentSchema.parse(item))
        .map(agentAsIntegrationFor(`${root}/${slug}`)),
      ...Object.values(INNATE_INTEGRATIONS),
    ];
  },
});

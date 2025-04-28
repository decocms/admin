import { AgentSchema } from "@deco/sdk";
import { z } from "zod";
import { client } from "../../db/client.ts";
import { assertUserHasAccessToWorkspace } from "../../auth/assertions.ts";
import { createApiHandler } from "../../utils/context.ts";

export const getAgent = createApiHandler({
  name: "AGENTS_GET",
  description: "Get an agent by id",
  schema: z.object({
    id: z.string().uuid(),
    workspace: z.string(),
  }),
  handler: async ({ id, workspace }, c) => {
    const assertions = assertUserHasAccessToWorkspace(workspace, c);

    const { data, error } = await client
      .from("deco_chat_agents")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error("Agent not found");
    }

    await assertions;

    return {
      content: [{
        type: "text",
        text: JSON.stringify(data),
      }],
    };
  },
});

export const createAgent = createApiHandler({
  name: "AGENTS_CREATE",
  description: "Create a new agent",
  schema: z.object({
    workspace: z.string(),
    agent: AgentSchema,
  }),
  handler: async ({ agent, workspace }, c) => {
    const assertions = assertUserHasAccessToWorkspace(workspace, c);

    const { data, error } = await client
      .from("deco_chat_agents")
      .insert({ ...agent, workspace })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    await assertions;

    return {
      content: [{
        type: "text",
        text: JSON.stringify(data),
      }],
    };
  },
});

export const updateAgent = createApiHandler({
  name: "AGENTS_UPDATE",
  description: "Update an existing agent",
  schema: z.object({
    id: z.string().uuid(),
    workspace: z.string(),
    agent: AgentSchema,
  }),
  handler: async ({ id, workspace, agent }, c) => {
    const assertions = assertUserHasAccessToWorkspace(workspace, c);

    const { data, error } = await client
      .from("deco_chat_agents")
      .update(agent)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error("Agent not found");
    }

    await assertions;

    return {
      content: [{
        type: "text",
        text: JSON.stringify(data),
      }],
    };
  },
});

export const deleteAgent = createApiHandler({
  name: "AGENTS_DELETE",
  description: "Delete an agent by id",
  schema: z.object({
    id: z.string().uuid(),
    workspace: z.string(),
  }),
  handler: async ({ id, workspace }, c) => {
    const assertions = assertUserHasAccessToWorkspace(workspace, c);

    const { error } = await client
      .from("deco_chat_agents")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }

    await assertions;

    return {
      content: [{
        type: "text",
        text: "Agent deleted successfully",
      }],
    };
  },
});

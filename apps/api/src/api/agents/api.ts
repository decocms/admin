import { AgentSchema } from "@deco/sdk";
import { z } from "zod";
import { supabase } from "../../db/client.ts";
import { createApiHandler } from "../../utils/context.ts";

export const getAgent = createApiHandler({
  name: "AGENTS_GET",
  description: "Get an agent by id",
  schema: z.object({ id: z.string().uuid() }),
  handler: async ({ id }) => {
    const { data, error } = await supabase
      .from("agents")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error("Agent not found");
    }

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
  schema: z.object({ agent: AgentSchema }),
  handler: async ({ agent }) => {
    const { data, error } = await supabase
      .from("agents")
      .insert(agent)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

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
  schema: z.object({ id: z.string().uuid(), agent: AgentSchema }),
  handler: async ({ id, agent }) => {
    const { data, error } = await supabase
      .from("agents")
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
  schema: z.object({ id: z.string().uuid() }),
  handler: async ({ id }) => {
    const { error } = await supabase
      .from("agents")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }

    return {
      content: [{
        type: "text",
        text: "Agent deleted successfully",
      }],
    };
  },
});

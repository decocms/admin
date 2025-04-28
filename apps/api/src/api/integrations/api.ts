import { IntegrationSchema } from "@deco/sdk";
import { z } from "zod";
import { client } from "../../db/client.ts";
import { createApiHandler } from "../../utils/context.ts";

// API Functions
export const getIntegration = createApiHandler({
  name: "INTEGRATIONS_GET",
  description: "Get an integration by id",
  schema: z.object({ id: z.string().uuid() }),
  handler: async ({ id }) => {
    const { data, error } = await client
      .from("integrations")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error("Integration not found");
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify(data),
      }],
    };
  },
});

export const createIntegration = createApiHandler({
  name: "INTEGRATIONS_CREATE",
  description: "Create a new integration",
  schema: IntegrationSchema,
  handler: async ({ name, description, icon, connection, workspace }) => {
    const { data, error } = await client
      .from("integrations")
      .insert({
        name,
        description,
        icon,
        connection,
        workspace,
      })
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

export const updateIntegration = createApiHandler({
  name: "INTEGRATIONS_UPDATE",
  description: "Update an existing integration",
  schema: z.object({
    id: z.string().uuid(),
    integration: IntegrationSchema,
  }),
  handler: async (
    { id, integration: { name, description, icon, connection, workspace } },
  ) => {
    const { data, error } = await client
      .from("integrations")
      .update({
        name,
        description,
        icon,
        connection,
        workspace,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error("Integration not found");
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify(data),
      }],
    };
  },
});

export const deleteIntegration = createApiHandler({
  name: "INTEGRATIONS_DELETE",
  description: "Delete an integration by id",
  schema: z.object({ id: z.string().uuid() }),
  handler: async ({ id }) => {
    const { error } = await client
      .from("integrations")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }

    return {
      content: [{
        type: "text",
        text: "Integration deleted successfully",
      }],
    };
  },
});

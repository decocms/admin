import { IntegrationSchema } from "@deco/sdk";
import { z } from "zod";
import { client } from "../../db/client.ts";
import { createApiHandler } from "../../utils/context.ts";
import { assertUserHasAccessToWorkspace } from "../../auth/assertions.ts";

// API Functions
export const getIntegration = createApiHandler({
  name: "INTEGRATIONS_GET",
  description: "Get an integration by id",
  schema: z.object({
    workspace: z.string(),
    id: z.string().uuid(),
  }),
  handler: async ({ id, workspace }, c) => {
    const assertions = assertUserHasAccessToWorkspace(workspace, c);

    const { data, error } = await client
      .from("deco_chat_integrations")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error("Integration not found");
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

export const createIntegration = createApiHandler({
  name: "INTEGRATIONS_CREATE",
  description: "Create a new integration",
  schema: z.object({
    workspace: z.string(),
    integration: IntegrationSchema,
  }),
  handler: async ({ workspace, integration }, c) => {
    const assertions = assertUserHasAccessToWorkspace(workspace, c);

    const { data, error } = await client
      .from("deco_chat_integrations")
      .insert({ ...integration, workspace })
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

export const updateIntegration = createApiHandler({
  name: "INTEGRATIONS_UPDATE",
  description: "Update an existing integration",
  schema: z.object({
    id: z.string().uuid(),
    workspace: z.string(),
    integration: IntegrationSchema,
  }),
  handler: async ({ id, workspace, integration }, c) => {
    const assertions = assertUserHasAccessToWorkspace(workspace, c);

    const { data, error } = await client
      .from("deco_chat_integrations")
      .update(integration)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error("Integration not found");
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

export const deleteIntegration = createApiHandler({
  name: "INTEGRATIONS_DELETE",
  description: "Delete an integration by id",
  schema: z.object({
    workspace: z.string(),
    id: z.string().uuid(),
  }),
  handler: async ({ id, workspace }, c) => {
    const assertions = assertUserHasAccessToWorkspace(workspace, c);

    const { error } = await client
      .from("deco_chat_integrations")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }

    await assertions;

    return {
      content: [{
        type: "text",
        text: "Integration deleted successfully",
      }],
    };
  },
});

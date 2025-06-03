import { z } from "zod";
import { InternalServerError, NotFoundError } from "../../errors.ts";
import { QueryResult } from "../../storage/index.ts";
import {
  assertHasWorkspace,
  canAccessWorkspaceResource,
} from "../assertions.ts";
import { ChannelBinding } from "../bindings/binder.ts";
import { createTool } from "../context.ts";
import { convertFromDatabase } from "../integrations/api.ts";

const SELECT_CHANNEL_QUERY = `
  *,
  integration:deco_chat_integrations!inner(
    *
  )
` as const;

function mapChannel(
  channel: QueryResult<"deco_chat_channels", typeof SELECT_CHANNEL_QUERY>,
) {
  return {
    id: channel.id,
    agentId: channel.agent_id,
    createdAt: channel.created_at,
    updatedAt: channel.updated_at,
    workspace: channel.workspace,
    active: channel.active,
    integration: channel.integration
      ? convertFromDatabase(channel.integration)
      : null,
  };
}

export const listChannels = createTool({
  name: "CHANNELS_LIST",
  description: "List all channels",
  inputSchema: z.object({}),
  canAccess: canAccessWorkspaceResource,
  handler: async (
    _,
    c,
  ) => {
    assertHasWorkspace(c);
    const db = c.db;
    const workspace = c.workspace.value;

    const query = db
      .from("deco_chat_channels")
      .select(SELECT_CHANNEL_QUERY)
      .eq("workspace", workspace);

    const { data, error } = await query;

    if (error) {
      throw new InternalServerError(error.message);
    }

    return {
      channels: data.map(mapChannel),
    };
  },
});

export const createChannel = createTool({
  name: "CHANNELS_CREATE",
  description: "Create a channel",
  inputSchema: z.object({
    channelId: z.string().describe(
      "The ID of the agent(current) to create the channel for, use only UUIDs",
    ),
    name: z.string().describe("The name of the channel"),
  }),
  canAccess: canAccessWorkspaceResource,
  handler: async (
    { channelId, name },
    c,
  ) => {
    assertHasWorkspace(c);
    const db = c.db;
    const workspace = c.workspace.value;

    // Insert the new channel
    const { data: channel, error } = await db.from("deco_chat_channels")
      .insert({
        id: channelId,
        workspace,
        active: true,
        name,
      })
      .select(SELECT_CHANNEL_QUERY)
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    // If the channel has an agent_id and integration, call ON_CHANNEL_LINKED
    if (channel.agent_id && channel.integration) {
      const binding = ChannelBinding.forConnection(
        convertFromDatabase(channel.integration).connection,
      );
      await binding.ON_CHANNEL_LINKED({
        channelId,
        workspace,
        agentId: channel.agent_id,
        callbacks: {
          stream: "", // Placeholder as requested
          generate: "", // Placeholder as requested
          generateObject: "", // Placeholder as requested
        },
      });
    }

    return mapChannel(channel);
  },
});

export const channelLink = createTool({
  name: "CHANNELS_LINK",
  description: "Link a channel to an agent",
  inputSchema: z.object({
    channelId: z.string().describe(
      "The ID of the agent(current) to create the trigger for, use only UUIDs.",
    ),
    agentId: z.string().describe(
      "The ID of the agent to link the channel to, use only UUIDs.",
    ),
  }),
  canAccess: canAccessWorkspaceResource,
  handler: async (
    { agentId, channelId },
    c,
  ) => {
    assertHasWorkspace(c);
    const db = c.db;
    const workspace = c.workspace.value;

    // Update the channel with the agent_id
    const { data: channel, error } = await db.from("deco_chat_channels")
      .update({ agent_id: agentId })
      .eq("id", channelId)
      .eq("workspace", workspace)
      .select(SELECT_CHANNEL_QUERY)
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    // Call ON_CHANNEL_LINKED if integration exists
    if (channel.integration) {
      const binding = ChannelBinding.forConnection(
        convertFromDatabase(channel.integration).connection,
      );
      await binding.ON_CHANNEL_LINKED({
        channelId,
        workspace,
        agentId,
        callbacks: {
          stream: "", // Placeholder as requested
          generate: "", // Placeholder as requested
          generateObject: "", // Placeholder as requested
        },
      });
    }

    return mapChannel(channel);
  },
});

export const channelUnlink = createTool({
  name: "CHANNELS_UNLINK",
  description: "Unlink a channel from an agent",
  inputSchema: z.object({
    channelId: z.string().describe(
      "The ID of the agent(current) to create the trigger for, use only UUIDs.",
    ),
  }),
  canAccess: canAccessWorkspaceResource,
  handler: async (
    { channelId },
    c,
  ) => {
    assertHasWorkspace(c);
    const db = c.db;
    const workspace = c.workspace.value;

    // Update the channel with the agent_id
    const { data: channel, error } = await db.from("deco_chat_channels")
      .update({ agent_id: null })
      .eq("id", channelId)
      .eq("workspace", workspace)
      .select(SELECT_CHANNEL_QUERY)
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    // Call ON_CHANNEL_LINKED if integration exists
    if (channel.integration) {
      const binding = ChannelBinding.forConnection(
        convertFromDatabase(channel.integration).connection,
      );
      await binding.ON_CHANNEL_UNLINKED({
        channelId,
        workspace,
      });
    }

    return mapChannel(channel);
  },
});

export const getChannel = createTool({
  name: "CHANNELS_GET",
  description: "Get a channel by ID",
  inputSchema: z.object({ id: z.string() }),
  canAccess: canAccessWorkspaceResource,
  handler: async (
    { id: channelId },
    c,
  ) => {
    assertHasWorkspace(c);
    const db = c.db;
    const workspace = c.workspace.value;

    const { data: channel, error } = await db.from("deco_chat_channels")
      .select(SELECT_CHANNEL_QUERY)
      .eq("id", channelId)
      .eq("workspace", workspace)
      .maybeSingle();

    if (error) {
      throw new InternalServerError(error.message);
    }

    if (!channel) {
      throw new NotFoundError("Channel not found");
    }

    return mapChannel(channel);
  },
});

export const activateChannel = createTool({
  name: "CHANNELS_ACTIVATE",
  description: "Activate a channel",
  inputSchema: z.object({ channelId: z.string() }),
  canAccess: canAccessWorkspaceResource,
  handler: async ({ channelId }, c) => {
    assertHasWorkspace(c);
    const db = c.db;
    const workspace = c.workspace.value;

    const { data, error: selectError } = await db.from("deco_chat_channels")
      .select(SELECT_CHANNEL_QUERY)
      .eq("id", channelId)
      .eq("workspace", workspace)
      .single();

    if (selectError) {
      throw new InternalServerError(selectError.message);
    }

    if (data?.active) {
      return {
        ok: true,
      };
    }

    if (data.agent_id) {
      const binding = ChannelBinding.forConnection(
        convertFromDatabase(data.integration).connection,
      );
      await binding.ON_CHANNEL_LINKED({
        channelId,
        workspace,
        agentId: data.agent_id,
        callbacks: {
          stream: "", // Placeholder as requested
          generate: "", // Placeholder as requested
          generateObject: "", // Placeholder as requested
        },
      });
    }

    const { error } = await db.from("deco_chat_triggers")
      .update({ active: true })
      .eq("id", channelId)
      .eq("workspace", workspace);

    if (error) {
      throw new InternalServerError(error.message);
    }

    return {
      ok: true,
    };
  },
});

export const deactivateChannel = createTool({
  name: "CHANNELS_DEACTIVATE",
  description: "Deactivate a channel",
  inputSchema: z.object({ channelId: z.string() }),
  canAccess: canAccessWorkspaceResource,
  handler: async ({ channelId }, c) => {
    assertHasWorkspace(c);
    const db = c.db;
    const workspace = c.workspace.value;

    const { data, error: selectError } = await db.from("deco_chat_channels")
      .select(SELECT_CHANNEL_QUERY)
      .eq("id", channelId)
      .eq("workspace", workspace)
      .single();

    if (selectError) {
      throw new InternalServerError(selectError.message);
    }

    if (!data?.active) {
      return {
        ok: true,
      };
    }
    if (data.agent_id) {
      const binding = ChannelBinding.forConnection(
        convertFromDatabase(data.integration).connection,
      );
      await binding.ON_CHANNEL_UNLINKED({
        channelId,
        workspace,
      });
    }

    const { error } = await db.from("deco_chat_channels")
      .update({ active: false })
      .eq("id", channelId)
      .eq("workspace", workspace);

    if (error) {
      throw new InternalServerError(error.message);
    }
    return {
      ok: true,
    };
  },
});

export const deleteChannel = createTool({
  name: "CHANNELS_DELETE",
  description: "Delete a channel",
  inputSchema: z.object({ channelId: z.string(), agentId: z.string() }),
  canAccess: canAccessWorkspaceResource,
  handler: async (
    { channelId },
    c,
  ) => {
    assertHasWorkspace(c);
    const db = c.db;
    const workspace = c.workspace.value;

    const { data: channel, error: selectError } = await db.from(
      "deco_chat_channels",
    )
      .select(SELECT_CHANNEL_QUERY)
      .eq("id", channelId)
      .eq("workspace", workspace)
      .single();

    if (selectError) {
      throw new InternalServerError(selectError.message);
    }

    if (channel.agent_id) {
      const binding = ChannelBinding.forConnection(
        convertFromDatabase(channel.integration).connection,
      );
      await binding.ON_CHANNEL_UNLINKED({
        channelId,
        workspace,
      });
    }

    const { error } = await db.from("deco_chat_channels")
      .delete()
      .eq("id", channelId)
      .eq("workspace", workspace);

    if (error) {
      throw new InternalServerError(error.message);
    }

    return {
      channelId,
      agentId: channel.agent_id,
    };
  },
});

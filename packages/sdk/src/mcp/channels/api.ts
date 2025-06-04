import type { TriggerData } from "@deco/ai";
import { Trigger } from "@deco/ai/actors";
import { join } from "node:path/posix";
import { z } from "zod";
import { InternalServerError, NotFoundError } from "../../errors.ts";
import { Path } from "../../path.ts";
import { QueryResult } from "../../storage/index.ts";
import {
  assertHasWorkspace,
  canAccessWorkspaceResource,
} from "../assertions.ts";
import { ChannelBinding } from "../bindings/binder.ts";
import { AppContext, createTool } from "../context.ts";
import { convertFromDatabase } from "../integrations/api.ts";

const SELECT_CHANNEL_QUERY = `
  *,
  integration:deco_chat_integrations!inner(
    *
  ),
  agents:deco_chat_channel_agents(
    agent_id
  )
` as const;

function mapChannel(
  channel: QueryResult<"deco_chat_channels", typeof SELECT_CHANNEL_QUERY>,
) {
  return {
    id: channel.id,
    discriminator: channel.discriminator,
    agentIds: Array.isArray(channel.agents)
      ? channel.agents.map((a: { agent_id: string }) => a.agent_id)
      : [],
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
    discriminator: z.string().describe(
      "The channel discriminator",
    ),
    name: z.string().describe("The name of the channel"),
    integrationId: z.string().describe("The ID of the integration to use"),
    agentIds: z.array(z.string()).optional().describe(
      "The IDs of the agents to link the channel to.",
    ),
  }),
  canAccess: canAccessWorkspaceResource,
  handler: async (
    { discriminator, name, integrationId, agentIds },
    c,
  ) => {
    assertHasWorkspace(c);
    const db = c.db;
    const workspace = c.workspace.value;

    // Insert the new channel
    const { data: channel, error } = await db.from("deco_chat_channels")
      .insert({
        discriminator,
        workspace,
        name,
        integration_id: integrationId.replace("i:", ""),
      })
      .select(SELECT_CHANNEL_QUERY)
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    // Link agents if provided
    const allAgentIds = agentIds ?? [];
    if (allAgentIds.length > 0) {
      await Promise.all(
        allAgentIds.map((aid) =>
          db.from("deco_chat_channel_agents").insert({
            channel_id: channel.id,
            agent_id: aid,
          })
        ),
      );
    }

    // If the channel has agents and integration, call LINK_CHANNEL for each
    if (allAgentIds.length > 0 && channel.integration) {
      const binding = ChannelBinding.forConnection(
        convertFromDatabase(channel.integration).connection,
      );
      await Promise.all(
        allAgentIds.map(async (aid) => {
          const trigger = await createWebhookTrigger(discriminator, aid, c);
          await binding.LINK_CHANNEL({
            discriminator,
            workspace,
            agentId: aid,
            callbacks: trigger.callbacks,
          });
        }),
      );
    }

    // Re-fetch with agents
    const { data: fullChannel, error: fetchError } = await db.from(
      "deco_chat_channels",
    )
      .select(SELECT_CHANNEL_QUERY)
      .eq("id", channel.id)
      .single();
    if (fetchError) throw new InternalServerError(fetchError.message);
    return mapChannel(fullChannel);
  },
});

export const channelLink = createTool({
  name: "CHANNELS_LINK",
  description: "Link a channel to an agent",
  inputSchema: z.object({
    discriminator: z.string().describe(
      "The channel discriminator",
    ),
    id: z.string().describe(
      "The ID of the channel to link, use only UUIDs.",
    ),
    agentId: z.string().describe(
      "The ID of the agent to link the channel to, use only UUIDs.",
    ),
  }),
  canAccess: canAccessWorkspaceResource,
  handler: async (
    { id, agentId, discriminator },
    c,
  ) => {
    assertHasWorkspace(c);
    const db = c.db;
    const workspace = c.workspace.value;

    // Insert into join table (if not exists)
    await db.from("deco_chat_channel_agents")
      .upsert({ channel_id: id, agent_id: agentId }, {
        onConflict: "channel_id,agent_id",
      });

    // Fetch channel with agents
    const { data: channel, error } = await db.from("deco_chat_channels")
      .select(SELECT_CHANNEL_QUERY)
      .eq("id", id)
      .eq("workspace", workspace)
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    // Call LINK_CHANNEL if integration exists
    if (channel.integration) {
      const binding = ChannelBinding.forConnection(
        convertFromDatabase(channel.integration).connection,
      );
      const trigger = await createWebhookTrigger(
        channel.discriminator,
        agentId,
        c,
      );
      await binding.LINK_CHANNEL({
        discriminator,
        workspace,
        agentId,
        callbacks: trigger.callbacks,
      });
    }

    return mapChannel(channel);
  },
});

export const channelUnlink = createTool({
  name: "CHANNELS_UNLINK",
  description: "Unlink a channel from an agent",
  inputSchema: z.object({
    id: z.string().describe(
      "The ID of the channel to unlink, use only UUIDs.",
    ),
    discriminator: z.string().describe(
      "The channel discriminator",
    ),
    agentId: z.string().describe(
      "The ID of the agent to unlink, use only UUIDs.",
    ),
  }),
  canAccess: canAccessWorkspaceResource,
  handler: async (
    { id, discriminator, agentId },
    c,
  ) => {
    assertHasWorkspace(c);
    const db = c.db;
    const workspace = c.workspace.value;

    // Remove from join table
    await db.from("deco_chat_channel_agents")
      .delete()
      .eq("channel_id", id)
      .eq("agent_id", agentId);

    // Fetch channel with agents
    const { data: channel, error } = await db.from("deco_chat_channels")
      .select(SELECT_CHANNEL_QUERY)
      .eq("id", id)
      .eq("workspace", workspace)
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    // Call UNLINK_CHANNEL if integration exists
    if (channel.integration) {
      const binding = ChannelBinding.forConnection(
        convertFromDatabase(channel.integration).connection,
      );
      await binding.UNLINK_CHANNEL({
        discriminator,
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
    { id },
    c,
  ) => {
    assertHasWorkspace(c);
    const db = c.db;
    const workspace = c.workspace.value;

    const { data: channel, error } = await db.from("deco_chat_channels")
      .select(SELECT_CHANNEL_QUERY)
      .eq("id", id)
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

const createWebhookTrigger = async (
  discriminator: string,
  agentId: string,
  c: AppContext,
) => {
  assertHasWorkspace(c);
  const triggerPath = Path.resolveHome(
    join(
      Path.folders.Agent.root(agentId),
      Path.folders.trigger(discriminator),
    ),
    c.workspace.value,
  ).path;
  // Create new trigger
  const trigger = await c.stub(Trigger).new(triggerPath).create(
    {
      id: discriminator,
      type: "webhook" as const,
      passphrase: crypto.randomUUID() as string,
      title: "Channel Webhook",
    } satisfies TriggerData,
  );
  if (!trigger.ok) {
    throw new InternalServerError("Failed to create trigger");
  }
  return trigger;
};

export const deleteChannel = createTool({
  name: "CHANNELS_DELETE",
  description: "Delete a channel",
  inputSchema: z.object({ id: z.string() }),
  canAccess: canAccessWorkspaceResource,
  handler: async (
    { id },
    c,
  ) => {
    assertHasWorkspace(c);
    const db = c.db;
    const workspace = c.workspace.value;

    const { data: channel, error: selectError } = await db.from(
      "deco_chat_channels",
    )
      .select(SELECT_CHANNEL_QUERY)
      .eq("id", id)
      .eq("workspace", workspace)
      .single();

    if (selectError) {
      throw new InternalServerError(selectError.message);
    }

    const binding = ChannelBinding.forConnection(
      convertFromDatabase(channel.integration).connection,
    );
    await binding.UNLINK_CHANNEL({
      discriminator: channel.discriminator,
      workspace,
    });

    const { error } = await db.from("deco_chat_channels")
      .delete()
      .eq("id", id)
      .eq("workspace", workspace);

    if (error) {
      throw new InternalServerError(error.message);
    }

    return {
      id,
    };
  },
});

import type { TriggerData } from "@deco/ai";
import { Trigger } from "@deco/ai/actors";
import { Hosts } from "@deco/sdk/hosts";
import { join } from "node:path/posix";
import { z } from "zod";
import { InternalServerError, NotFoundError } from "../../errors.ts";
import { Path } from "../../path.ts";
import { QueryResult } from "../../storage/index.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
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
    agent_id,
    agent:deco_chat_agents(id, name)
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
    name: channel.name ?? undefined,
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
  handler: async (_, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c.tool.name, c);

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
    integrationId: z.string().describe("The ID of the integration to use"),
    agentId: z.string().optional().describe(
      "The ID of the agent to join the channel.",
    ),
    name: z.string().optional().describe(
      "The name of the channel",
    ),
  }),
  handler: async ({ discriminator, integrationId, agentId, name }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c.tool.name, c);

    const db = c.db;
    const workspace = c.workspace.value;

    // Insert the new channel
    const { data: channel, error } = await db.from("deco_chat_channels")
      .insert({
        discriminator,
        workspace,
        integration_id: integrationId.replace("i:", ""),
        name,
      })
      .select(SELECT_CHANNEL_QUERY)
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    // Link agents if provided
    if (agentId) {
      await db.from("deco_chat_channel_agents").insert({
        channel_id: channel.id,
        agent_id: agentId,
      });
      const binding = ChannelBinding.forConnection(
        convertFromDatabase(channel.integration).connection,
      );

      const [trigger, { data, error }] = await Promise.all([
        createWebhookTrigger(discriminator, agentId, c),
        c.db.from("deco_chat_agents").select("name")
          .eq("id", agentId).single(),
      ]);
      if (error) {
        throw new InternalServerError(error.message);
      }
      if (!data) {
        throw new NotFoundError(`agent ${agentId} not found`);
      }
      await binding.DECO_CHAT_CHANNELS_JOIN({
        agentLink: generateAgentLink(c.workspace, agentId),
        discriminator,
        workspace,
        agentName: data.name,
        agentId,
        callbacks: trigger.callbacks,
      });
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

const generateAgentLink = (
  workspace: { root: string; value: string; slug: string },
  agentId: string,
) => {
  return `https://${Hosts.Chat}${
    workspace.root === "users" ? "/" : `${workspace.slug}/`
  }agent/${agentId}/${crypto.randomUUID()}`;
};

const getAgentName = (
  channel: QueryResult<"deco_chat_channels", typeof SELECT_CHANNEL_QUERY>,
  agentId: string,
) => {
  return channel.agents.find((agent) => agent.agent_id === agentId)?.agent
    ?.name ?? "Deco Agent";
};

export const channelJoin = createTool({
  name: "CHANNELS_JOIN",
  description: "Invite an agent to a channel",
  inputSchema: z.object({
    id: z.string().describe(
      "The ID of the channel to join, use only UUIDs.",
    ),
    agentId: z.string().describe(
      "The ID of the agent to join the channel to, use only UUIDs.",
    ),
  }),
  handler: async ({ id, agentId }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c.tool.name, c);

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

    // Call JOIN_CHANNEL if integration exists
    if (channel.integration) {
      const binding = ChannelBinding.forConnection(
        convertFromDatabase(channel.integration).connection,
      );
      const trigger = await createWebhookTrigger(
        channel.discriminator,
        agentId,
        c,
      );
      const agentName = getAgentName(channel, agentId);
      await binding.DECO_CHAT_CHANNELS_JOIN({
        agentName,
        agentLink: generateAgentLink(c.workspace, agentId),
        discriminator: channel.discriminator,
        workspace,
        agentId,
        callbacks: trigger.callbacks,
      });
    }

    return mapChannel(channel);
  },
});

export const channelLeave = createTool({
  name: "CHANNELS_LEAVE",
  description: "Remove an agent from a channel",
  inputSchema: z.object({
    id: z.string().describe(
      "The ID of the channel to unlink, use only UUIDs.",
    ),
    agentId: z.string().describe(
      "The ID of the agent to unlink, use only UUIDs.",
    ),
  }),
  handler: async ({ id, agentId }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c.tool.name, c);

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

    // Call LEAVE_CHANNEL if integration exists
    if (channel.integration) {
      const binding = ChannelBinding.forConnection(
        convertFromDatabase(channel.integration).connection,
      );
      await binding.DECO_CHAT_CHANNELS_LEAVE({
        discriminator: channel.discriminator,
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
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c.tool.name, c);

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
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c.tool.name, c);

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
    await binding.DECO_CHAT_CHANNELS_LEAVE({
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

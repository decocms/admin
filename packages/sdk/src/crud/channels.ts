import { MCPClient } from "../fetcher.ts";
import { Channel } from "../models/channels.ts";
export type { Channel };

/**
 * List all channels in a workspace
 * @param workspace - The workspace to list channels from
 * @param signal - Optional AbortSignal for cancellation
 * @returns Array of channels
 */
export const listChannels = (
  workspace: string,
  signal?: AbortSignal,
): Promise<{ channels: Channel[] }> =>
  MCPClient.forWorkspace(workspace).CHANNELS_LIST(
    {},
    { signal },
  );

/**
 * Create a new channel
 * @param workspace - The workspace to create the channel in
 * @param channel - The channel data to create
 * @returns The created channel
 */
export const createChannel = (
  workspace: string,
  channel: {
    discriminator: string;
    name: string;
    integrationId: string;
    agentId?: string;
  },
) => MCPClient.forWorkspace(workspace).CHANNELS_CREATE(channel);

/**
 * Get a channel by ID
 * @param workspace - The workspace of the channel
 * @param id - The ID of the channel to get
 * @param signal - Optional AbortSignal for cancellation
 * @returns The channel
 */
export const getChannel = (
  workspace: string,
  id: string,
  signal?: AbortSignal,
): Promise<Channel> =>
  MCPClient.forWorkspace(workspace).CHANNELS_GET(
    { id },
    { signal },
  );

/**
 * Link a channel to an agent
 * @param workspace - The workspace of the channel
 * @param channelId - The ID of the channel to link
 * @param agentId - The ID of the agent to link to
 * @param discriminator - The channel discriminator
 * @returns The updated channel
 */
export const linkChannel = (
  workspace: string,
  channelId: string,
  agentId: string,
  discriminator: string,
) =>
  MCPClient.forWorkspace(workspace).CHANNELS_LINK({
    id: channelId,
    agentId,
    discriminator,
  });

/**
 * Unlink a channel from an agent
 * @param workspace - The workspace of the channel
 * @param channelId - The ID of the channel to unlink
 * @param discriminator - The channel discriminator
 * @returns The updated channel
 */
export const unlinkChannel = (
  workspace: string,
  channelId: string,
  discriminator: string,
) =>
  MCPClient.forWorkspace(workspace).CHANNELS_UNLINK({
    id: channelId,
    discriminator,
  });

/**
 * Activate a channel
 * @param workspace - The workspace of the channel
 * @param channelId - The ID of the channel to activate
 * @returns Success response
 */
export const activateChannel = (
  workspace: string,
  channelId: string,
) =>
  MCPClient.forWorkspace(workspace).CHANNELS_ACTIVATE({
    id: channelId,
  });

/**
 * Deactivate a channel
 * @param workspace - The workspace of the channel
 * @param channelId - The ID of the channel to deactivate
 * @returns Success response
 */
export const deactivateChannel = (
  workspace: string,
  channelId: string,
) =>
  MCPClient.forWorkspace(workspace).CHANNELS_DEACTIVATE({
    id: channelId,
  });

/**
 * Delete a channel
 * @param workspace - The workspace of the channel
 * @param channelId - The ID of the channel to delete
 * @returns Delete response with id and agentId
 */
export const deleteChannel = (
  workspace: string,
  channelId: string,
) =>
  MCPClient.forWorkspace(workspace).CHANNELS_DELETE({
    id: channelId,
  });

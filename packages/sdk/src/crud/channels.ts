import { MCPClient } from "../fetcher.ts";
import type { WellKnownBindings } from "../mcp/index.ts";
import type { Channel } from "../models/channels.ts";
import type { MCPConnection } from "../models/mcp.ts";
import { ProjectLocator } from "../locator.ts";
export type { Channel };

/**
 * List all channels in a workspace
 * @param locator - Project locator
 * @param signal - Optional AbortSignal for cancellation
 * @returns Array of channels
 */
export const listChannels = (
  locator: ProjectLocator,
  signal?: AbortSignal,
): Promise<{ channels: Channel[] }> =>
  MCPClient.forLocator(locator).CHANNELS_LIST({}, { signal }) as Promise<{
    channels: Channel[];
  }>;

/**
 * Create a new channel
 * @param locator - Project locator
 * @param channel - The channel data to create
 * @returns The created channel
 */
export const createChannel = (
  locator: ProjectLocator,
  channel: {
    discriminator: string;
    integrationId: string;
    agentId?: string;
    name?: string;
  },
): Promise<Channel> =>
  MCPClient.forLocator(locator).CHANNELS_CREATE(channel) as Promise<Channel>;

/**
 * Get a channel by ID
 * @param locator - Project locator
 * @param id - The ID of the channel to get
 * @param signal - Optional AbortSignal for cancellation
 * @returns The channel
 */
export const getChannel = (
  locator: ProjectLocator,
  id: string,
  signal?: AbortSignal,
): Promise<Channel> =>
  MCPClient.forLocator(locator).CHANNELS_GET(
    { id },
    { signal },
  ) as Promise<Channel>;

/**
 * Make a agent join the channel
 * @param locator - Project locator
 * @param channelId - The ID of the channel to join
 * @param agentId - The ID of the agent to join the channel
 * @returns The updated channel
 */
export const joinChannel = (
  locator: ProjectLocator,
  channelId: string,
  agentId: string,
): Promise<Channel> =>
  MCPClient.forLocator(locator).CHANNELS_JOIN({
    id: channelId,
    agentId,
  }) as Promise<Channel>;

/**
 * List available channels for a given connection
 */
export const listAvailableChannelsForConnection = (
  locator: ProjectLocator,
  connection: MCPConnection,
): Promise<{ channels: Channel[] }> =>
  MCPClient.forConnection<(typeof WellKnownBindings)["Channel"]>(connection)
    .DECO_CHAT_CHANNELS_LIST({
      workspace: locator,
    })
    .then((channels) => ({ channels })) as Promise<{ channels: Channel[] }>;

/**
 * Remove an agent from a channel
 * @param locator - Project locator
 * @param channelId - The ID of the channel to leave
 * @returns The updated channel
 */
export const leaveChannel = (
  locator: ProjectLocator,
  channelId: string,
  agentId: string,
): Promise<Channel> =>
  MCPClient.forLocator(locator).CHANNELS_LEAVE({
    id: channelId,
    agentId: agentId,
  }) as Promise<Channel>;

/**
 * Delete a channel
 * @param locator - Project locator
 * @param channelId - The ID of the channel to delete
 * @returns Delete response with id and agentId
 */
export const deleteChannel = (
  locator: ProjectLocator,
  channelId: string,
): Promise<Channel> =>
  MCPClient.forLocator(locator).CHANNELS_DELETE({
    id: channelId,
  }) as Promise<Channel>;

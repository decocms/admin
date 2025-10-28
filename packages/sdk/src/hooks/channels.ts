import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type Channel,
  createChannel,
  deleteChannel,
  getChannel,
  joinChannel,
  leaveChannel,
  listAvailableChannelsForConnection,
  listChannels,
} from "../crud/channels.ts";
import { InternalServerError } from "../errors.ts";
import { KEYS } from "./react-query-keys.ts";
import { useSDK } from "./store.tsx";
import type { Integration } from "../index.ts";

export const useCreateChannel = () => {
  const client = useQueryClient();
  const { locator } = useSDK();

  const create = useMutation({
    mutationFn: (channel: {
      discriminator: string;
      integrationId: string;
      agentId?: string;
      name?: string;
    }) => createChannel(locator, channel),
    onSuccess: (result) => {
      const itemKey = KEYS.CHANNELS(locator, result.id);
      client.cancelQueries({ queryKey: itemKey });
      client.setQueryData<Channel>(itemKey, result);

      const listKey = KEYS.CHANNELS(locator);
      client.cancelQueries({ queryKey: listKey });
      client.setQueryData<{ channels: Channel[] }>(listKey, (old) =>
        !old
          ? { channels: [result] }
          : {
              channels: [result, ...old.channels],
            },
      );
    },
  });

  return create;
};

export const useUpdateChannelCache = () => {
  const client = useQueryClient();
  const { locator } = useSDK();

  const update = (channel: Channel) => {
    const itemKey = KEYS.CHANNELS(locator, channel.id);
    client.cancelQueries({ queryKey: itemKey });
    client.setQueryData<Channel>(itemKey, channel ?? ({} as Channel));

    const listKey = KEYS.CHANNELS(locator);
    client.cancelQueries({ queryKey: listKey });
    client.setQueryData<{ channels: Channel[] }>(listKey, (old) =>
      !old
        ? { channels: [channel] }
        : {
            channels: old.channels.map((c) =>
              c.id === channel.id ? channel : c,
            ),
          },
    );
  };

  return update;
};

export const useJoinChannel = () => {
  const { locator } = useSDK();
  const updateChannelCache = useUpdateChannelCache();

  const res = useMutation({
    mutationFn: ({
      channelId,
      agentId,
    }: {
      channelId: string;
      agentId: string;
    }) => joinChannel(locator, channelId, agentId),
    onSuccess: (result) => updateChannelCache(result),
  });

  return res;
};

export const useLeaveChannel = () => {
  const { locator } = useSDK();
  const updateChannelCache = useUpdateChannelCache();

  const res = useMutation({
    mutationFn: ({
      channelId,
      agentId,
    }: {
      channelId: string;
      agentId: string;
    }) => leaveChannel(locator, channelId, agentId),
    onSuccess: (result) => updateChannelCache(result),
  });

  return res;
};

export const useRemoveChannel = () => {
  const client = useQueryClient();
  const { locator } = useSDK();

  const remove = useMutation({
    mutationFn: (id: string) => deleteChannel(locator, id),
    onSuccess: (_, id) => {
      const itemKey = KEYS.CHANNELS(locator, id);
      client.cancelQueries({ queryKey: itemKey });
      client.removeQueries({ queryKey: itemKey });

      const listKey = KEYS.CHANNELS(locator);
      client.cancelQueries({ queryKey: listKey });
      client.setQueryData<{ channels: Channel[] }>(listKey, (old) =>
        !old
          ? { channels: [] }
          : {
              channels: old.channels.filter((channel) => channel.id !== id),
            },
      );
    },
  });

  return remove;
};

export const useChannel = (id: string) => {
  const { locator } = useSDK();

  const data = useQuery({
    queryKey: KEYS.CHANNELS(locator, id),
    queryFn: ({ signal }) => getChannel(locator, id, signal),
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
  });

  return data;
};

export const useChannels = () => {
  const { locator } = useSDK();
  const client = useQueryClient();

  const data = useQuery({
    queryKey: KEYS.CHANNELS(locator),
    queryFn: async ({ signal }) => {
      const result = await listChannels(locator, signal);

      for (const item of result.channels) {
        const itemKey = KEYS.CHANNELS(locator, item.id);
        client.cancelQueries({ queryKey: itemKey });
        client.setQueryData<Channel>(itemKey, item);
      }

      return result;
    },
  });

  return data;
};

export const useConnectionChannels = (binding: Integration) => {
  const { locator } = useSDK();

  const data = useQuery({
    queryKey: KEYS.CHANNELS(locator, binding.id),
    queryFn: async () => {
      const result = await listAvailableChannelsForConnection(
        locator,
        binding.connection,
      ).catch((error) => {
        console.error(error);
        return { channels: [] };
      });

      return result;
    },
  });

  return data;
};

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  activateChannel,
  type Channel,
  createChannel,
  deactivateChannel,
  deleteChannel,
  getChannel,
  linkChannel,
  listChannels,
  unlinkChannel,
} from "../crud/channels.ts";
import { InternalServerError } from "../errors.ts";
import { KEYS } from "./api.ts";
import { useSDK } from "./store.tsx";

export const useCreateChannel = () => {
  const client = useQueryClient();
  const { workspace } = useSDK();

  const create = useMutation({
    mutationFn: (channel: {
      discriminator: string;
      name: string;
      integrationId: string;
      agentId?: string;
    }) => createChannel(workspace, channel),
    onSuccess: (result) => {
      const itemKey = KEYS.CHANNELS(workspace, result.id);
      client.cancelQueries({ queryKey: itemKey });
      client.setQueryData<Channel>(itemKey, result);

      const listKey = KEYS.CHANNELS(workspace);
      client.cancelQueries({ queryKey: listKey });
      client.setQueryData<{ channels: Channel[] }>(
        listKey,
        (old) =>
          !old ? { channels: [result] } : {
            channels: [result, ...old.channels],
          },
      );
    },
  });

  return create;
};

export const useUpdateChannelCache = () => {
  const client = useQueryClient();
  const { workspace } = useSDK();

  const update = (channel: Channel) => {
    const itemKey = KEYS.CHANNELS(workspace, channel.id);
    client.cancelQueries({ queryKey: itemKey });
    client.setQueryData<Channel>(itemKey, channel);

    const listKey = KEYS.CHANNELS(workspace);
    client.cancelQueries({ queryKey: listKey });
    client.setQueryData<{ channels: Channel[] }>(
      listKey,
      (old) =>
        !old ? { channels: [channel] } : {
          channels: old.channels.map((c) => c.id === channel.id ? channel : c),
        },
    );
  };

  return update;
};

export const useLinkChannel = () => {
  const { workspace } = useSDK();
  const updateChannelCache = useUpdateChannelCache();

  const link = useMutation({
    mutationFn: ({
      channelId,
      agentId,
      discriminator,
    }: {
      channelId: string;
      agentId: string;
      discriminator: string;
    }) => linkChannel(workspace, channelId, agentId, discriminator),
    onSuccess: (result) => updateChannelCache(result),
  });

  return link;
};

export const useUnlinkChannel = () => {
  const { workspace } = useSDK();
  const updateChannelCache = useUpdateChannelCache();

  const unlink = useMutation({
    mutationFn: ({
      channelId,
      discriminator,
    }: {
      channelId: string;
      discriminator: string;
    }) => unlinkChannel(workspace, channelId, discriminator),
    onSuccess: (result) => updateChannelCache(result),
  });

  return unlink;
};

export const useActivateChannel = () => {
  const { workspace } = useSDK();
  const client = useQueryClient();

  const activate = useMutation({
    mutationFn: (channelId: string) => activateChannel(workspace, channelId),
    onSuccess: (_, channelId) => {
      client.invalidateQueries({
        queryKey: KEYS.CHANNELS(workspace, channelId),
      });
      client.invalidateQueries({
        queryKey: KEYS.CHANNELS(workspace),
      });
    },
  });

  return activate;
};

export const useDeactivateChannel = () => {
  const { workspace } = useSDK();
  const client = useQueryClient();

  const deactivate = useMutation({
    mutationFn: (channelId: string) => deactivateChannel(workspace, channelId),
    onSuccess: (_, channelId) => {
      client.invalidateQueries({
        queryKey: KEYS.CHANNELS(workspace, channelId),
      });
      client.invalidateQueries({
        queryKey: KEYS.CHANNELS(workspace),
      });
    },
  });

  return deactivate;
};

export const useRemoveChannel = () => {
  const client = useQueryClient();
  const { workspace } = useSDK();

  const remove = useMutation({
    mutationFn: (id: string) => deleteChannel(workspace, id),
    onSuccess: (_, id) => {
      const itemKey = KEYS.CHANNELS(workspace, id);
      client.cancelQueries({ queryKey: itemKey });
      client.removeQueries({ queryKey: itemKey });

      const listKey = KEYS.CHANNELS(workspace);
      client.cancelQueries({ queryKey: listKey });
      client.setQueryData<{ channels: Channel[] }>(
        listKey,
        (old) =>
          !old ? { channels: [] } : {
            channels: old.channels.filter((channel) => channel.id !== id),
          },
      );
    },
  });

  return remove;
};

export const useChannel = (id: string) => {
  const { workspace } = useSDK();

  const data = useSuspenseQuery({
    queryKey: KEYS.CHANNELS(workspace, id),
    queryFn: ({ signal }) => getChannel(workspace, id, signal),
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
  });

  return data;
};

export const useChannels = () => {
  const { workspace } = useSDK();
  const client = useQueryClient();

  const data = useSuspenseQuery({
    queryKey: KEYS.CHANNELS(workspace),
    queryFn: async ({ signal }) => {
      const result = await listChannels(workspace, signal);

      for (const item of result.channels) {
        const itemKey = KEYS.CHANNELS(workspace, item.id);
        client.cancelQueries({ queryKey: itemKey });
        client.setQueryData<Channel>(itemKey, item);
      }

      return result;
    },
  });

  return data;
};

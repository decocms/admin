import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import {
  activateTrigger,
  createTrigger,
  deactivateTrigger,
  deleteTrigger,
  getTrigger,
  listAllTriggers,
  updateTrigger,
} from "../crud/trigger.ts";
import type {
  CreateTriggerInput,
  ListTriggersOutput,
  TriggerOutput,
} from "../models/trigger.ts";
import { KEYS } from "./api.ts";
import { useSDK } from "./store.tsx";

export function useTrigger(
  triggerId: string,
  options?: Omit<
    UseQueryOptions<TriggerOutput, Error, TriggerOutput, string[]>,
    "queryKey" | "queryFn"
  >,
) {
  const { locator } = useSDK();
  return useQuery({
    queryKey: KEYS.TRIGGER(locator, triggerId),
    queryFn: () => getTrigger(locator, triggerId),
    staleTime: 0,
    ...options,
  });
}

export function useListTriggers() {
  const { locator } = useSDK();
  const client = useQueryClient();

  return useQuery({
    queryKey: KEYS.TRIGGERS(locator),
    queryFn: async () => {
      const result = await listAllTriggers(locator);

      // Update individual trigger caches
      for (const trigger of result.triggers) {
        const itemKey = KEYS.TRIGGER(locator, trigger.id);
        client.cancelQueries({ queryKey: itemKey });
        client.setQueryData<TriggerOutput>(itemKey, trigger);
      }

      return result;
    },
  });
}

export function useUpdateTriggerCache() {
  const client = useQueryClient();
  const { locator } = useSDK();

  const update = (trigger: TriggerOutput) => {
    // Update the individual trigger in cache
    const itemKey = KEYS.TRIGGER(locator, trigger.id);
    client.cancelQueries({ queryKey: itemKey });
    client.setQueryData<TriggerOutput>(itemKey, trigger);

    // Update the list
    const listKey = KEYS.TRIGGERS(locator);
    client.cancelQueries({ queryKey: listKey });
    client.setQueryData<ListTriggersOutput>(listKey, (old) => {
      if (!old) return { triggers: [trigger] };
      return {
        triggers: old.triggers.map((t) => (t.id === trigger.id ? trigger : t)),
      };
    });
  };

  return update;
}

export function useCreateTrigger() {
  const { locator } = useSDK();
  const client = useQueryClient();

  return useMutation({
    mutationFn: (trigger: CreateTriggerInput) =>
      createTrigger(locator, trigger),
    onSuccess: (result) => {
      // update item
      const itemKey = KEYS.TRIGGER(locator, result.id);
      client.cancelQueries({ queryKey: itemKey });
      client.setQueryData<TriggerOutput>(itemKey, result);

      // update list
      const listKey = KEYS.TRIGGERS(locator);
      client.cancelQueries({ queryKey: listKey });
      client.setQueryData<ListTriggersOutput>(listKey, (old) => {
        if (!old) return { triggers: [result] };
        return { triggers: [result, ...old.triggers] };
      });
    },
  });
}

export function useUpdateTrigger() {
  const { locator } = useSDK();
  const updateTriggerCache = useUpdateTriggerCache();

  return useMutation({
    mutationFn: ({
      triggerId,
      trigger,
    }: {
      triggerId: string;
      trigger: CreateTriggerInput;
    }) => updateTrigger(locator, triggerId, trigger),
    onSuccess: (result) => updateTriggerCache(result),
  });
}

export function useDeleteTrigger() {
  const { locator } = useSDK();
  const client = useQueryClient();

  return useMutation({
    mutationFn: (triggerId: string) => deleteTrigger(locator, triggerId),
    onSuccess: (_, triggerId) => {
      // Remove the individual trigger from cache
      const itemKey = KEYS.TRIGGER(locator, triggerId);
      client.cancelQueries({ queryKey: itemKey });
      client.removeQueries({ queryKey: itemKey });

      // Update the list
      const listKey = KEYS.TRIGGERS(locator);
      client.cancelQueries({ queryKey: listKey });
      client.setQueryData<ListTriggersOutput>(listKey, (old) => {
        if (!old) return { triggers: [] };
        return {
          triggers: old.triggers.filter((trigger) => trigger.id !== triggerId),
        };
      });
    },
  });
}

export function useActivateTrigger() {
  const { locator } = useSDK();
  const client = useQueryClient();

  return useMutation({
    mutationFn: (triggerId: string) => activateTrigger(locator, triggerId),
    onSuccess: (result, triggerId) => {
      if (result.success) {
        // Update the trigger's active status in cache
        const itemKey = KEYS.TRIGGER(locator, triggerId);
        client.cancelQueries({ queryKey: itemKey });
        client.setQueryData<TriggerOutput>(
          itemKey,
          (old) => old ? { ...old, active: true } : undefined,
        );

        // Update lists
        const listKey = KEYS.TRIGGERS(locator);
        client.cancelQueries({ queryKey: listKey });
        client.setQueryData<ListTriggersOutput>(listKey, (old) => {
          if (!old) return old;
          return {
            triggers: old.triggers.map((t) =>
              t.id === triggerId ? { ...t, active: true } : t
            ),
          };
        });
      }
    },
  });
}

export function useDeactivateTrigger() {
  const { locator } = useSDK();
  const client = useQueryClient();

  return useMutation({
    mutationFn: (triggerId: string) => deactivateTrigger(locator, triggerId),
    onSuccess: (result, triggerId) => {
      if (result.success) {
        // Update the trigger's active status in cache
        const itemKey = KEYS.TRIGGER(locator, triggerId);
        client.cancelQueries({ queryKey: itemKey });
        client.setQueryData<TriggerOutput>(
          itemKey,
          (old) => old ? { ...old, active: false } : undefined,
        );

        // Update lists
        const listKey = KEYS.TRIGGERS(locator);
        client.cancelQueries({ queryKey: listKey });
        client.setQueryData<ListTriggersOutput>(listKey, (old) => {
          if (!old) return old;
          return {
            triggers: old.triggers.map((t) =>
              t.id === triggerId ? { ...t, active: false } : t
            ),
          };
        });
      }
    },
  });
}

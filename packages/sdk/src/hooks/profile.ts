import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { MCPClient } from "../fetcher.ts";
import { KEYS } from "./api.ts";

export const useProfile = () => {
  return useSuspenseQuery({
    queryKey: KEYS.PROFILE(),
    queryFn: async () => {
      const { ok, data, error } = await MCPClient.PROFILES_GET({});
      if (!ok || !data) {
        throw new Error(error?.message ?? "Failed to fetch user profile");
      }
      return data;
    },
  });
};

export const useUpdateProfile = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (
      updates: {
        name?: string | null;
        email?: string;
        phone?: string | null;
        deco_user_id?: number | null;
        is_new_user?: boolean | null;
      },
    ) => {
      const { ok, data, error } = await MCPClient.PROFILES_UPDATE(updates);
      if (!ok || !data) {
        throw new Error(error?.message ?? "Failed to update user profile");
      }
      return data;
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: KEYS.PROFILE() });
    },
  });
};

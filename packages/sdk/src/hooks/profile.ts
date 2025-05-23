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
    queryFn: () => MCPClient.PROFILES_GET({}),
  });
};

export const useUpdateProfile = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (updates: {
      name?: string | null;
      email?: string;
      phone?: string | null;
      deco_user_id?: number | null;
      is_new_user?: boolean | null;
    }) => MCPClient.PROFILES_UPDATE(updates),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: KEYS.PROFILE() });
    },
  });
};

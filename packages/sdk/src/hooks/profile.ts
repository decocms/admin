import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { MCPClient } from "../fetcher.ts";
import { KEYS } from "./react-query-keys.ts";

export const useProfile = () => {
  return useSuspenseQuery({
    queryKey: KEYS.PROFILE(),
    queryFn: () => MCPClient.PROFILES_GET({}),
    // Cache profile for 5 minutes since it rarely changes
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
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

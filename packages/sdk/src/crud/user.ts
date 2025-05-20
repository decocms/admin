import { MCPClient } from "../fetcher.ts";

export interface User {
  id: string;
  email: string;
  is_anonymous: boolean;
  metadata: {
    avatar_url: string;
    full_name?: string;
    username: string;
    email: string;
  };
}

export const fetchUser = async () => {
  const { ok, data, error } = await MCPClient.PROFILES_GET({});

  if (!ok || !data) {
    throw new Error(error?.message ?? "Failed to fetch user");
  }

  return data;
};

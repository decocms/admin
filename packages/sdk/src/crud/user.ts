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
  phone: string | null;
}

export const fetchUser = () => MCPClient.PROFILES_GET({});

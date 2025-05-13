import { callToolFor } from "../fetcher.ts";

export interface User {
  id: string;
  email: string;
  is_anonymous: boolean;
  metadata: {
    avatar_url: string;
    full_name: string;
    username: string;
  };
}

export class NotLoggedInError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotLoggedInError";
  }
}

export const fetchUser = async () => {
  const response = await callToolFor("", "PROFILES_GET", {});

  if (response.status === 401) {
    throw new NotLoggedInError("User is not logged in");
  }

  if (!response.ok) {
    throw new Error("Failed to fetch user");
  }

  const { error, data } = await response.json() as {
    error: Error;
    data: User;
  };

  if (error) {
    throw new Error(error.message || "Failed to fetch user");
  }

  return data;
};

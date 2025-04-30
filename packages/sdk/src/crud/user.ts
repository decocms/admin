import { callToolFor } from "../fetcher.ts";

export interface User {
  id: string;
  email: string;
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

  const { data } = await response.json();

  return JSON.parse(data.content[0].text);
};

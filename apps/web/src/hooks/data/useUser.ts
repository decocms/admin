import { AUTH_URL } from "@deco/sdk";
import { use } from "react";

export interface User {
  id: string;
  email: string;
  app_metadata: {
    provider: string;
  };
  isAdmin: boolean;
  is_anonymous: boolean;
  last_sign_in_at: string;
  walletHead: {
    total: string;
  };
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

const fetchUser = async () => {
  const response = await fetch(`${AUTH_URL}/api/user`, {
    credentials: "include",
  });

  if (response.status === 401) {
    throw new NotLoggedInError("User is not logged in");
  }

  if (!response.ok) {
    throw new Error("Failed to fetch user");
  }

  return response.json() as Promise<User>;
};

const promise = fetchUser();

export const onUserChange = (callback: (user: User) => void) =>
  promise.then((user) => callback(user));

export const useUser = () => use(promise);

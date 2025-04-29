import { AUTH_URL, callTool } from "@deco/sdk";
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

const fetchUser = async (): Promise<User> => {
  try {
    const { content } = await callTool({
      type: "HTTP",
      url: new URL("/mcp", AUTH_URL).href,
    }, {
      arguments: {},
      name: "PROFILES_GET",
    });
    const [{ text }] = content as [{ text: string }];
    const { content: [{ text: stringData }] } = JSON.parse(text);
    const user = JSON.parse(stringData);

    return user;
  } catch (_) {
    throw new NotLoggedInError("User is not logged in");
  }
};

const promise = fetchUser();

export const onUserChange = (callback: (user: User) => void) =>
  promise.then((user) => callback(user));

export const useUser = () => use(promise);

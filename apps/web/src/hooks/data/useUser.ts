import { fetchUser } from "@deco/sdk";
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

const promise = fetchUser();

export const onUserChange = (callback: (user: User) => void) =>
  promise.then((user) => callback(user));

export const useUser = () => use(promise);

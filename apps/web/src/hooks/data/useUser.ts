import { AUTH_URL } from "@deco/sdk";
import { use } from "react";
import { User } from "../../stores/global.tsx";

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

export const useUser = () => use(promise);

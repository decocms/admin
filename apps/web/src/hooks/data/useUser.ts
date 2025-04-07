import { AUTH_URL } from "../../constants.ts";
import { User } from "../../stores/global.tsx";
import { use } from "react";

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

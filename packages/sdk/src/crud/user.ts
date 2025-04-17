import { AUTH_URL } from "../constants.ts";

export interface User {
  id: string;
  email: string;
  metadata: {
    avatar_url: string;
    full_name: string;
    username: string;
  };
}

export const fetchUser = async () => {
  const response = await fetch(`${AUTH_URL}/api/user`, {
    credentials: "include",
  });

  if (response.status === 401) {
    throw new Error("User is not logged in");
  }

  if (!response.ok) {
    throw new Error("Failed to fetch user");
  }

  return response.json() as Promise<User>;
};

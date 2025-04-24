import { AUTH_URL } from "../constants.ts";
import { createFetcher } from "../fetcher.ts";

// Create a custom fetcher for auth endpoints
const authFetcher = createFetcher(AUTH_URL);

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
  const response = await authFetcher({
    path: "/api/user",
  });

  if (response.status === 401) {
    throw new Error("User is not logged in");
  }

  if (!response.ok) {
    throw new Error("Failed to fetch user");
  }

  return response.json() as Promise<User>;
};

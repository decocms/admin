import { API_HEADERS, API_SERVER_URL } from "../constants.ts";

const toPath = (segments: string[]) => segments.join("/");

const fetchAPI = (segments: string[], init?: RequestInit) =>
  fetch(new URL(toPath(segments), API_SERVER_URL), {
    ...init,
    credentials: "include",
    headers: { ...API_HEADERS, ...init?.headers },
  });

export interface User {
  id: string;
  email: string;
  app_metadata: {
    provider: string;
  };
  is_anonymous: boolean;
  last_sign_in_at: string;
  user_metadata: {
    avatar_url: string;
    full_name: string;
  };
}

export class NotLoggedInError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotLoggedInError";
  }
}

export const fetchUser = async () => {
  const response = await fetchAPI(["auth", "user"]);

  if (response.status === 401) {
    throw new NotLoggedInError("User is not logged in");
  }

  if (!response.ok) {
    throw new Error("Failed to fetch user");
  }

  const user = await response.json() as Promise<User>;
  console.log("user", user);
  return user;
};

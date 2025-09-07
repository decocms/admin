import { FailedToFetchUserError } from "@/components/logged-provider";
import { useSuspenseQuery } from "@tanstack/react-query";
import { client } from "./rpc-logged";

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
}

/**
 * This hook will throw an error if the user is not logged in.
 * You can safely use it inside routes that are protected by the `LoggedProvider`.
 */
export const useUser = () => {
  return useSuspenseQuery({
    queryKey: ["user"],
    queryFn: () =>
      client.GET_USER(
        {},
        {
          handleResponse: (res: Response) => {
            if (res.status === 401) {
              throw new FailedToFetchUserError(
                "Failed to fetch user",
                globalThis.location.href,
              );
            }

            return res.json();
          },
        },
      ),
    retry: false,
  });
};

/**
 * This hook will return null if the user is not logged in.
 * You can safely use it inside routes that are not protected by the `LoggedProvider`.
 * Good for pages that are public, for example.
 */
export const useOptionalUser = () => {
  return useSuspenseQuery({
    queryKey: ["user"],
    queryFn: () =>
      client.GET_USER(
        {},
        {
          handleResponse: async (res: Response) => {
            if (res.status === 401) {
              return null;
            }
            return res.json();
          },
        },
      ),
    retry: false,
  });
};

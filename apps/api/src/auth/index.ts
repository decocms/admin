import type { User } from "@deco/sdk";
import { createSupabaseClient } from "../db/client.ts";
import { getCookies } from "../lib/cookie.ts";

// TODO: add LRU Cache
export const getUser = async (request: Request): Promise<User | undefined> => {
  const cookies = getCookies(request.headers);
  const supabase = createSupabaseClient({
    cookies: {
      getAll: () =>
        Object.entries(cookies).map(([name, value]) => ({
          name,
          value,
        })),
      setAll: (_cookies) => {
      },
    },
  });

  const { data } = await supabase.auth.getUser(undefined);

  const user = data?.user;

  if (!user) {
    return undefined;
  }

  return user as unknown as User;
};

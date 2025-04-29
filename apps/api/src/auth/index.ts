import type { User } from "@deco/sdk";
import { createSupabaseClient } from "../db/client.ts";
import { getCookies } from "../utils/cookie.ts";
import { AppContext, getEnv } from "../utils/context.ts";

// TODO: add LRU Cache
export const getUser = async (ctx: AppContext): Promise<User | undefined> => {
  const { SUPABASE_URL, SUPABASE_SERVER_TOKEN } = getEnv(ctx);

  const cookies = getCookies(ctx.req.raw.headers);
  const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_SERVER_TOKEN, {
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

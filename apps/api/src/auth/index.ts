import { createSupabaseClient } from "../db/client.ts";
import { getCookies } from "../lib/cookie.ts";

// TODO: add LRU Cache
export const getUser = async (request: Request) => {
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
  const { data: _user } = await supabase.auth.getUser(
    undefined,
  );
  const user = _user?.user;
  if (!user) {
    return undefined;
  }

  return user;
};

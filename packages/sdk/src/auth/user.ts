import type { AuthUser, SupabaseClient } from "@supabase/supabase-js";
import { jwtDecode } from "jwt-decode";
import { LRUCache } from "lru-cache";
import {
  createSupabaseSessionClient,
  getSessionToken,
  parseAuthorizationHeader,
} from "./supabase.ts";

export type { AuthUser };
const ONE_MINUTE_MS = 60e3;
const cache = new LRUCache<string, AuthUser>({
  max: 1000,
  ttl: ONE_MINUTE_MS,
});

const MILLISECONDS = 1e3;

export async function getUserBySupabaseCookie(
  request: Request,
  supabaseServerToken: string | SupabaseClient,
): Promise<AuthUser | undefined> {
  const accessToken = parseAuthorizationHeader(request);
  const sessionToken = getSessionToken(request);
  if (!sessionToken && !accessToken) {
    return undefined;
  }
  if (sessionToken && cache.has(sessionToken)) {
    return cache.get(sessionToken);
  }
  if (accessToken && cache.has(accessToken)) {
    return cache.get(accessToken);
  }
  const { supabase } = typeof supabaseServerToken === "string"
    ? createSupabaseSessionClient(
      request,
      supabaseServerToken,
    )
    : { supabase: supabaseServerToken };
  const { data: _user } = await supabase.auth.getUser(
    accessToken,
  );
  const user = _user?.user;
  if (!user) {
    return undefined;
  }
  let cachettl = undefined;
  if (sessionToken) {
    const { data: session } = await supabase.auth.getSession();
    cachettl = session?.session?.expires_at;
  }
  if (accessToken) {
    try {
      const decoded = jwtDecode(accessToken, { header: true }) as {
        expires_at: number;
      };
      cachettl = (decoded.expires_at * MILLISECONDS) - Date.now();
    } catch (err) {
      console.error(err);
      // ignore if any error
    }
  }
  const cacheToken = sessionToken || accessToken;
  if (cachettl && cacheToken) {
    cache.set(cacheToken, user, { ttl: cachettl });
  }

  return user;
}

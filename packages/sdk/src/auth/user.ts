import type { AuthUser, SupabaseClient } from "@supabase/supabase-js";
import { LRUCache } from "lru-cache";
import type { Principal } from "../mcp/context.ts";
import {
  JwtIssuer,
  JwtPayloadWithClaims,
  type JwtIssuerKeyPair,
} from "./jwt.ts";
import {
  createSupabaseSessionClient,
  getSessionToken,
  parseAuthorizationToken,
} from "./supabase.ts";

export type { AuthUser };
const ONE_MINUTE_MS = 60e3;
// Promise cache for single-flight pattern - stores promises (both in-flight and resolved)
const promiseCache = new LRUCache<string, Promise<Principal | undefined>>({
  max: 1000,
  ttl: ONE_MINUTE_MS,
});

export const userFromJWT = async (
  jwt: string,
  keyPair?: JwtIssuerKeyPair,
): Promise<Principal | undefined> => {
  const jwtIssuer = await JwtIssuer.forKeyPair(keyPair);
  const payload = await jwtIssuer.verify(jwt);
  return payload;
};

export async function getUserBySupabaseCookie(
  request: Request,
  supabaseServerToken: string | SupabaseClient,
  keyPair?: JwtIssuerKeyPair,
): Promise<Principal | undefined> {
  const accessToken = parseAuthorizationToken(request);
  const sessionToken = getSessionToken(request);

  // Use sessionToken as primary key, fallback to accessToken
  // We know at least one exists because of the check above
  const cacheKey = sessionToken || accessToken;
  if (!cacheKey) {
    return undefined;
  }

  // Check if there's already a promise for this token (single-flight for in-flight, cache for resolved)
  if (promiseCache.has(cacheKey)) {
    return promiseCache.get(cacheKey);
  }

  // Create the promise and store it in the promise cache
  async function fetchUserFromSession(): Promise<Principal | undefined> {
    const { supabase } =
      typeof supabaseServerToken === "string"
        ? createSupabaseSessionClient(request, supabaseServerToken)
        : { supabase: supabaseServerToken };

    const [{ data: _user }, [jwt]] = await Promise.all([
      supabase.auth.getUser(accessToken),
      JwtIssuer.forKeyPair(keyPair).then((jwtIssuer) =>
        jwtIssuer.verify(sessionToken).then((jwt) => {
          if (!jwt && accessToken) {
            return jwtIssuer
              .verify(accessToken)
              .then(
                (payload) =>
                  [payload, accessToken] as [JwtPayloadWithClaims, string],
              );
          }
          return [jwt, sessionToken] as [JwtPayloadWithClaims, string];
        }),
      ),
    ]);

    const user = _user?.user;
    if (!user) {
      return jwt ?? undefined;
    }

    return user;
  }

  const promise = fetchUserFromSession();

  // Store the promise in the cache
  promiseCache.set(cacheKey, promise);

  // Remove promise from cache only if it rejects (so retries can happen)
  // If it resolves, keep it in cache (with TTL) so we can reuse the value
  promise.catch(() => {
    promiseCache.delete(cacheKey);
  });

  return promise;
}

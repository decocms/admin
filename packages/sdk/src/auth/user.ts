import type { AuthUser, SupabaseClient } from "@supabase/supabase-js";
import { decodeJwt } from "jose";
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

const MILLISECONDS = 1e3;

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
  async function fetchUserFromSession(): Promise<
    [Principal | undefined, number]
  > {
    const { supabase } =
      typeof supabaseServerToken === "string"
        ? createSupabaseSessionClient(request, supabaseServerToken)
        : { supabase: supabaseServerToken };

    const [{ data }, [jwt, key]] = await Promise.all([
      supabase.auth.getUser(accessToken),
      JwtIssuer.forKeyPair(keyPair).then((jwtIssuer) =>
        jwtIssuer.verify(sessionToken).then((jwt) => {
          if (!jwt && accessToken) {
            return jwtIssuer
              .verify(accessToken)
              .then(
                (jwt) => [jwt, accessToken] as [JwtPayloadWithClaims, string],
              );
          }
          return [jwt, sessionToken] as [JwtPayloadWithClaims, string];
        }),
      ),
    ]);

    const user = data?.user;
    if (!user) {
      const shouldCache = jwt && key;

      return [jwt ?? undefined, shouldCache ? ONE_MINUTE_MS : 0];
    }

    // Get the cache TTL
    let cachettl = undefined;
    if (sessionToken) {
      const { data: session } = await supabase.auth.getSession();
      cachettl = session?.session?.expires_at;
    }
    if (accessToken) {
      try {
        const decoded = decodeJwt(accessToken) as {
          expires_at: number;
        };
        cachettl = decoded.expires_at * MILLISECONDS - Date.now();
      } catch (err) {
        console.error(err);
        // ignore if any error
      }
    }

    return [user, cachettl ?? ONE_MINUTE_MS];
  }

  const promise = fetchUserFromSession();
  const userPromise = promise.then(([user, ttl]) => {
    // Sets the ttl to the right value
    if (ttl > 0) {
      promiseCache.set(cacheKey, userPromise, { ttl });
    } else {
      promiseCache.delete(cacheKey);
    }

    return user ?? undefined;
  });

  // Store the promise in the cache
  promiseCache.set(cacheKey, userPromise, { ttl: ONE_MINUTE_MS });

  // Remove promise from cache only if it rejects (so retries can happen)
  // If it resolves, keep it in cache (with TTL) so we can reuse the value
  userPromise.catch(() => {
    promiseCache.delete(cacheKey);
  });

  return userPromise;
}

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
const cache = new LRUCache<string, Principal>({
  max: 1000,
  ttl: 10 * ONE_MINUTE_MS, // Cache auth tokens for 10 minutes to reduce Supabase auth calls
  updateAgeOnGet: true, // Reset TTL on access to keep frequently used tokens cached
});

// Track in-flight requests to prevent parallel calls to Supabase for same token
const inflightRequests = new Map<string, Promise<Principal | undefined>>();

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
  const jwtIssuer = await JwtIssuer.forKeyPair(keyPair);
  const accessToken = parseAuthorizationToken(request);
  const sessionToken = getSessionToken(request);

  const url = new URL(request.url);
  const cacheKey = sessionToken || accessToken;

  if (!sessionToken && !accessToken) {
    return undefined;
  }

  if (sessionToken && cache.has(sessionToken)) {
    const principal = cache.get(sessionToken);
    // Add cache status for logging
    if (principal) {
      (principal as unknown as { _cacheStatus?: string })._cacheStatus = "hit";
    }
    return principal;
  }
  if (accessToken && cache.has(accessToken)) {
    const principal = cache.get(accessToken);
    // Add cache status for logging
    if (principal) {
      (principal as unknown as { _cacheStatus?: string })._cacheStatus = "hit";
    }
    return principal;
  }

  // Check if there's already an in-flight request for this token
  if (cacheKey && inflightRequests.has(cacheKey)) {
    const principal = await inflightRequests.get(cacheKey);
    // Mark as deduplicated for logging
    if (principal) {
      (principal as unknown as { _cacheStatus?: string })._cacheStatus =
        "dedup";
    }
    return principal;
  }

  // Create promise for this auth request and track it to prevent duplicates
  const authPromise = (async () => {
    const { supabase } =
      typeof supabaseServerToken === "string"
        ? createSupabaseSessionClient(request, supabaseServerToken)
        : { supabase: supabaseServerToken };

    let getUserResult;
    try {
      getUserResult = await supabase.auth.getUser(accessToken);
    } catch (error: unknown) {
      // Log which endpoint caused the rate limit error
      const err = error as { message?: string; status?: number; code?: string };
      console.error(`[AUTH] ❌ Supabase error for ${url.pathname}:`, {
        error: err?.message || String(error),
        status: err?.status,
        code: err?.code,
        url: url.href,
      });
      throw error;
    }

    const [{ data: _user }, [jwt, key]] = await Promise.all([
      Promise.resolve(getUserResult),
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
    ]);

    const user = _user?.user;
    if (!user) {
      if (jwt && key) {
        cache.set(key, jwt);
      }
      return jwt;
    }
    let cachettl = undefined;
    if (sessionToken) {
      try {
        const { data: session } = await supabase.auth.getSession();
        cachettl = session?.session?.expires_at;
      } catch (error: unknown) {
        const err = error as {
          message?: string;
          status?: number;
          code?: string;
        };
        console.error(
          `[AUTH] ❌ Supabase getSession error for ${url.pathname}:`,
          {
            error: err?.message || String(error),
            status: err?.status,
            code: err?.code,
            url: url.href,
          },
        );
        throw error;
      }
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
    const cacheToken = sessionToken || accessToken;
    if (cachettl && cacheToken) {
      cache.set(cacheToken, user, { ttl: cachettl });
    }

    // Mark as cache miss for logging
    (user as unknown as { _cacheStatus?: string })._cacheStatus = "miss";
    return user;
  })();

  // Track this request
  if (cacheKey) {
    inflightRequests.set(cacheKey, authPromise);
  }

  // Clean up when done
  try {
    const result = await authPromise;
    return result;
  } finally {
    if (cacheKey) {
      inflightRequests.delete(cacheKey);
    }
  }
}

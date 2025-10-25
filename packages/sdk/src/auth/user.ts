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
    console.log(`[AUTH] ✓ Cache HIT for ${url.pathname}`);
    return cache.get(sessionToken);
  }
  if (accessToken && cache.has(accessToken)) {
    console.log(`[AUTH] ✓ Cache HIT for ${url.pathname}`);
    return cache.get(accessToken);
  }
  
  // Check if there's already an in-flight request for this token
  if (cacheKey && inflightRequests.has(cacheKey)) {
    console.log(`[AUTH] ⏳ Waiting for in-flight request for ${url.pathname}`);
    return inflightRequests.get(cacheKey);
  }
  
  // Log when we're about to call Supabase (causing rate limits)
  console.log(`[AUTH] ✗ Cache MISS for ${url.pathname} - calling Supabase`);
  
  // Create promise for this auth request and track it to prevent duplicates
  const authPromise = (async () => {
    const { supabase } =
      typeof supabaseServerToken === "string"
        ? createSupabaseSessionClient(request, supabaseServerToken)
        : { supabase: supabaseServerToken };
    
    let getUserResult;
    try {
      getUserResult = await supabase.auth.getUser(accessToken);
    } catch (error: any) {
      // Log which endpoint caused the rate limit error
      console.error(`[AUTH] ❌ Supabase error for ${url.pathname}:`, {
        error: error?.message || String(error),
        status: error?.status,
        code: error?.code,
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
            .then((jwt) => [jwt, accessToken] as [JwtPayloadWithClaims, string]);
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
    } catch (error: any) {
      console.error(`[AUTH] ❌ Supabase getSession error for ${url.pathname}:`, {
        error: error?.message || String(error),
        status: error?.status,
        code: error?.code,
        url: url.href,
      });
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

import { type User } from "@deco/sdk";
import {
  EmailOtpType,
  type Provider,
  type User as SupaUser,
} from "@supabase/supabase-js";
import { createSupabaseClient } from "../db/client.ts";
import { getCookies } from "../utils/cookie.ts";
import { AppContext, AUTH_URL, getEnv } from "../utils/context.ts";
import { authSetCookie, getServerClientOptions } from "../utils/db.ts";

export const ROUTES = {
  authCallbackPath: "/auth/callback/oauth",
  authCallbackMagiclinkPath: "/auth/callback/magiclink",
  loginOauth: "/login/oauth",
  loginMagicLink: "/login/magiclink",
  logout: "/auth/logout",
} as const;
const HAS_LOGGED_IN_COOKIE = "hasLoggedInBefore";

const createDbAndHeadersForRequest = (ctx: AppContext) => {
  const { SUPABASE_URL, SUPABASE_SERVER_TOKEN } = getEnv(ctx);
  const request = ctx.req.raw;
  const { headers, setCookie } = authSetCookie({ request });
  const db = createSupabaseClient(
    SUPABASE_URL,
    SUPABASE_SERVER_TOKEN,
    getServerClientOptions({
      cookies: getCookies(ctx.req.raw.headers),
      setCookie,
    }),
  );

  return { headers, db };
};

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

export const createLoginUrl = async (ctx: AppContext) => {
  const { db, headers } = createDbAndHeadersForRequest(ctx);
  const request = ctx.req.raw;
  const url = new URL(request.url);
  const provider = (url.searchParams.get("provider") ?? "google") as Provider;
  const redirectTo = new URL(
    ROUTES.authCallbackPath,
    AUTH_URL(ctx),
  );

  const next = url.searchParams.get("next");
  if (next) {
    redirectTo.searchParams.set("next", next);
  }

  const credentials = {
    provider,
    options: {
      redirectTo: redirectTo.toString(),
    },
  };

  const { data } = await db.auth.signInWithOAuth(credentials);

  return { url: data.url, headers };
};

export const loginUser = async (ctx: AppContext) => {
  const { db, headers } = createDbAndHeadersForRequest(ctx);
  const request = ctx.req.raw;
  const url = new URL(request.url);
  const nextDefault = new URL("/", url.origin).toString();
  const redirectUrl = url.searchParams.get("next") || nextDefault;
  const code = url.searchParams.get("code");

  if (!code) {
    throw new Error("No code provided");
  }

  const { error } = await db.auth.exchangeCodeForSession(code);

  if (error) {
    throw new Error("Failed to finish login flow");
  }

  headers.append("set-cookie", `${HAS_LOGGED_IN_COOKIE}=true; Path=/`);

  return { redirectUrl, headers };
};

export const createMagicLinkEmail = async (ctx: AppContext) => {
  const formData = await ctx.req.json() as { email: string };
  const email = formData.email;
  const request = ctx.req.raw;

  try {
    const { db } = createDbAndHeadersForRequest(ctx);

    const url = new URL(request.url);

    // We do not send the full path to supabase but the email template
    // includes a condition to insert it (/auth/callback/magiclink)
    const redirectTo = url.host.includes("localhost")
      ? "http://localhost:3001/"
      : "https://api.deco.chat/";

    await db.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    });
    return { email };
  } catch (_) {
    return { error: "" };
  }
};

export const loginMagicLink = async (ctx: AppContext) => {
  const request = ctx.req.raw;
  const { db, headers } = createDbAndHeadersForRequest(ctx);
  const url = new URL(request.url);
  const next = url.searchParams.get("next") ||
    (url.host.includes("localhost")
      ? "http://localhost:3000"
      : "https://deco.chat");
  const tokenHash = url.searchParams.get("tokenHash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  if (!tokenHash || !type) {
    throw new Error(
      "Missing tokenHash or type",
    );
  }

  const { error } = await db.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    throw new Error("Failed to finish login flow");
  }

  headers.append("set-cookie", `${HAS_LOGGED_IN_COOKIE}=true; Path=/`);

  return { headers, redirectUrl: next };
};

export const logoutUser = async (ctx: AppContext) => {
  const url = new URL(ctx.req.url);
  const { db, headers } = createDbAndHeadersForRequest(ctx);
  await db.auth.signOut();

  return { headers, redirectUrl: url.searchParams.get("next") ?? "/" };
};

export const enrichUser = (user: SupaUser) => {
  const metadata = getUserMetadata(user);

  return { ...user, metadata };
};

const getUserMetadata = (
  user: SupaUser,
): User["metadata"] => {
  return {
    full_name: user.user_metadata.full_name,
    avatar_url: user.user_metadata.avatar_url,
    username: generateUsername(user.user_metadata.full_name),
  };
};

const generateUsername = (fullName: string) => {
  const username = `${
    fullName.toLocaleLowerCase().normalize("NFD").replace(
      /[\u0300-\u036f]/g,
      "",
    ).replace(/\s+/g, "-").replace(/[^\w-]/g, "")
  }${Date.now().toString(36)}`;

  return username;
};

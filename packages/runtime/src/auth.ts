import { JWK, jwtVerify } from "jose";
import type { DefaultEnv } from "./index.ts";

const DECO_APP_AUTH_COOKIE_NAME = "deco_page_auth";

export interface State {
  next?: string;
}

export const StateParser = {
  parse: (state: string) => {
    return JSON.parse(decodeURIComponent(atob(state))) as State;
  },
  stringify: (state: State) => {
    return btoa(encodeURIComponent(JSON.stringify(state)));
  },
};

// Helper function to parse cookies from request
const parseCookies = (cookieHeader: string): Record<string, string> => {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(";").forEach((cookie) => {
    const [name, ...rest] = cookie.trim().split("=");
    if (name && rest.length > 0) {
      cookies[name] = decodeURIComponent(rest.join("="));
    }
  });

  return cookies;
};

const parseJWK = (jwk: string): JWK => JSON.parse(atob(jwk)) as JWK;

export const getReqToken = async (req: Request, env: DefaultEnv) => {
  const token = () => {
    // First try to get token from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      return authHeader.split(" ")[1];
    }

    // If not found, try to get from cookie
    const cookieHeader = req.headers.get("Cookie");
    if (cookieHeader) {
      const cookies = parseCookies(cookieHeader);
      return cookies[DECO_APP_AUTH_COOKIE_NAME];
    }

    return undefined;
  };

  const authToken = token();
  if (!authToken) {
    return undefined;
  }

  env.DECO_API_JWT_PUBLIC_KEY &&
    (await jwtVerify(authToken, parseJWK(env.DECO_API_JWT_PUBLIC_KEY), {
      issuer: "https://api.decocms.com",
    }).catch((err) => {
      console.error(`[auth-token]: error validating: ${err}`);
    }));

  return authToken;
};

export interface AuthCallbackOptions {
  apiUrl?: string;
  appName: string;
}

export const handleAuthCallback = async (
  req: Request,
  options: AuthCallbackOptions,
): Promise<Response> => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code) {
    return new Response("Missing authorization code", { status: 400 });
  }

  // Parse state to get the next URL
  let next = "/";
  if (state) {
    try {
      const parsedState = StateParser.parse(state);
      next = parsedState.next || "/";
    } catch {
      // ignore parse errors
    }
  }

  try {
    // Exchange code for token
    const apiUrl = options.apiUrl ?? "https://api.decocms.com";
    const exchangeResponse = await fetch(`${apiUrl}/apps/code-exchange`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        client_id: options.appName,
      }),
    });

    if (!exchangeResponse.ok) {
      console.error(
        "authentication failed",
        code,
        options.appName,
        await exchangeResponse.text().catch((_) => ""),
      );
      return new Response("Authentication failed", { status: 401 });
    }

    const { access_token } = (await exchangeResponse.json()) as {
      access_token: string;
    };

    if (!access_token) {
      return new Response("No access token received", { status: 401 });
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: next,
        "Set-Cookie":
          `${DECO_APP_AUTH_COOKIE_NAME}=${access_token}; HttpOnly; SameSite=None; Secure; Path=/`,
      },
    });
  } catch (err) {
    return new Response(`Authentication failed ${err}`, { status: 500 });
  }
};

const removeAuthCookie = (headers: Headers) => {
  headers.set(
    "Set-Cookie",
    `${DECO_APP_AUTH_COOKIE_NAME}=; HttpOnly; SameSite=None; Secure; Path=/; Max-Age=0`,
  );
};

export const handleLogout = (req: Request) => {
  const url = new URL(req.url);
  const next = url.searchParams.get("next");
  const redirectTo = new URL("/", url);
  const headers = new Headers();
  removeAuthCookie(headers);
  headers.set("Location", next ?? redirectTo.href);
  return new Response(null, {
    status: 302,
    headers,
  });
};

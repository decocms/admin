import {
  type createServerClient,
  serializeCookieHeader,
  type SetAllCookies,
} from "@supabase/ssr";

export type Options = Parameters<typeof createServerClient>;

const getCookieDomain = (hostname: string) =>
  hostname.split(".").slice(-2).join(".");

export const getServerClientOptions = ({
  cookies,
  setCookie,
}: {
  cookies: Record<string, string>;
  setCookie?: SetAllCookies;
}): Options[2] => {
  return {
    cookies: {
      getAll: () =>
        Object.entries(cookies).map(([name, value]) => ({
          name,
          value,
        })),
      setAll: setCookie ?? ((_cookies) => {}),
    },
  };
};

const shouldSetCookieForLocalhost = (url: URL) => {
  const next = url.searchParams.get("next");
  if (!next) {
    return false;
  }

  const nextUrl = new URL(next);
  return nextUrl.hostname === "localhost" || nextUrl.hostname === "127.0.0.1";
};

export const authSetCookie = ({ request }: { request: Request }) => {
  const headers = new Headers();
  const setCookie: SetAllCookies = (cookies) => {
    const url = new URL(request.url);
    const shouldSetForLocalhost = shouldSetCookieForLocalhost(url);
    const rootDomain = getCookieDomain(url.hostname);
    for (const { name, value, options } of cookies) {
      headers.append(
        "set-cookie",
        serializeCookieHeader(name, value, {
          ...options,
          sameSite: "none", // allow for subdomains.
          secure: true,
          domain: shouldSetForLocalhost ? "localhost" : `.${rootDomain}`,
        }),
      );
    }
  };

  return { setCookie, headers };
};

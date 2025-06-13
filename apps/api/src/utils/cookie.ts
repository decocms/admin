import type { HonoAppContext } from "./context.ts";

// from @std/http
export function getCookies(headers: Headers): Record<string, string> {
  const cookie = headers.get("Cookie");
  if (cookie !== null) {
    const out: Record<string, string> = {};
    const c = cookie.split(";");
    for (const kv of c) {
      const [cookieKey, ...cookieVal] = kv.split("=");
      if (cookieKey === undefined) {
        throw new SyntaxError("Cookie cannot start with '='");
      }
      const key = cookieKey.trim();
      out[key] = cookieVal.join("=");
    }
    return out;
  }
  return {};
}

export function setHeaders(headers: Headers, ctx: HonoAppContext) {
  headers.forEach((headerValue, headerName) => {
    ctx.res.headers.append(headerName, headerValue);
  });
}

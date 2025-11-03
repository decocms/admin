import { Hono } from "hono";
import { AppEnv } from "./utils/context.ts";
import { createMcpServerProxy } from "./api.ts";

export interface WithOAuthOptions {
  hono: Hono<AppEnv>;
  mcpPath: string;
}

const withoutLeadingSlash = (path: string) => {
  return path.startsWith("/") ? path.slice(1) : path;
}

const withoutTrailingSlash = (path: string) => {
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

const sanitize = (path: string) => {
  return withoutLeadingSlash(withoutTrailingSlash(path));
}
/**
 * Adds MCP 
 */
export const withOAuth = ({ hono, mcpPath: mcpPathParam }: WithOAuthOptions) => {
  const mcpPath = `/${sanitize(mcpPathParam)}`;
  hono.all(mcpPath, async (c) => {
    const session = c.req.raw.headers.get("Authorization")?.split(" ")[1];
    if (!session) {

      return new Response(null, {
        status: 401,
        headers: {
          "WWW-Authenticate": `Bearer realm="mcp",resource_metadata="${c.req.url}/.well-known/oauth-protected-resource"`,
        },
      });
    }
    const proxy = await createMcpServerProxy(c);
    return proxy.fetch(c.req.raw);
  });
  hono.get(`${mcpPath}/.well-known/oauth-protected-resource/*`, async (c) => { })
  hono.get(`${mcpPath}/.well-known/oauth-authorization-server/*`, async (c) => { })
}
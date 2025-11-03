import { Hono } from "hono";
import { createMcpServerProxy } from "./api.ts";
import { AppEnv } from "./utils/context.ts";

export interface WithOAuthOptions {
  hono: Hono<AppEnv>;
  mcpEndpoint: string;
}

const withoutLeadingSlash = (path: string) => {
  return path.startsWith("/") ? path.slice(1) : path;
};

const withoutTrailingSlash = (path: string) => {
  return path.endsWith("/") ? path.slice(0, -1) : path;
};

const sanitize = (path: string) => {
  return withoutLeadingSlash(withoutTrailingSlash(path));
};
/**
 * Adds MCP
 */
export const withOAuth = ({
  hono,
  mcpEndpoint: mcpEndpointParam,
}: WithOAuthOptions) => {
  const mcpEndpoint = `/${sanitize(mcpEndpointParam)}`;
  const oauthEndpoint = `${mcpEndpoint}/oauth`;
  const tokenEndpoint = `${oauthEndpoint}/token`;
  const authorizationEndpoint = `${oauthEndpoint}/authorize`;
  const userinfoEndpoint = `${oauthEndpoint}/userinfo`;
  const registrationEndpoint = `${oauthEndpoint}/register`;


  hono.all(mcpEndpoint, async (c) => {
    const session = c.req.raw.headers.get("Authorization")?.split(" ")[1];
    if (!session) {
      const wwwAuthenticateValue = `Bearer realm="mcp",resource_metadata="${c.req.url}/.well-known/oauth-protected-resource"`;
      return Response.json(
        {
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Unauthorized: Authentication required",
            "www-authenticate": wwwAuthenticateValue,
          },
          id: null,
        },
        {
          status: 401,
          headers: {
            "WWW-Authenticate": wwwAuthenticateValue,
            // we also add this headers otherwise browser based clients will not be able to read the `www-authenticate` header
            "Access-Control-Expose-Headers": "WWW-Authenticate",
          },
        },
      );;
    }
    const proxy = await createMcpServerProxy(c);
    return proxy.fetch(c.req.raw);
  });
  hono.get(`${mcpEndpoint}/.well-known/oauth-protected-resource/*`, async (c) => {
    const url = new URL(c.req.url);
    const authMetadata = {
      resource: url.origin,
      authorization_servers: [`${url.origin}${oauthEndpoint}`],
      jwks_uri: `${url.origin}/.well-known/jwks.json`,
      scopes_supported: ["*"], // this should be all tools proxied by the MCP server
      bearer_methods_supported: ["header"],
      resource_signing_alg_values_supported: ["RS256", "none"],
    };
    return Response.json(authMetadata);
  });
  hono.get(`${mcpEndpoint}/.well-known/oauth-authorization-server/*`, async (c) => {
    const url = new URL(c.req.url);
    const authorizationServerMetadata = {
      issuer: url.origin,
      authorization_endpoint: `${url.origin}${authorizationEndpoint}`,
      token_endpoint: `${url.origin}${tokenEndpoint}`,
      userinfo_endpoint: `${url.origin}${userinfoEndpoint}`,
      jwks_uri: `${url.origin}/.well-known/jwks.json`,
      registration_endpoint: `${url.origin}${registrationEndpoint}`,
      scopes_supported: ["*"],
      response_types_supported: ["code"],
      response_modes_supported: ["query"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      acr_values_supported: [
        "urn:mace:incommon:iap:silver",
        "urn:mace:incommon:iap:bronze",
      ],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256", "none"],
      token_endpoint_auth_methods_supported: [
        "client_secret_basic",
        "client_secret_post",
        "none",
      ],
      code_challenge_methods_supported: ["S256"],
      claims_supported: [
        "sub",
        "iss",
        "aud",
        "exp",
        "nbf",
        "iat",
        "jti",
        "email",
        "email_verified",
        "name",
      ],
    };

    return Response.json(authorizationServerMetadata);
  });
};

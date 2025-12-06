import { DECO_CMS_WEB_URL, Locator } from "@deco/sdk";
import { fromWorkspaceString, workspaceDB } from "@deco/sdk/mcp";
import type { Context, Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { createMcpServerProxy, honoCtxToAppCtx } from "./api.ts";
import { ensureOAuthTables } from "./oauth/schema.ts";
import {
  encodeOAuthState,
  generateRandomToken,
  getCurrentTimestamp,
  isValidRedirectUriFormat,
  validateRedirectUri,
} from "./oauth/utils.ts";
import type { AppEnv } from "./utils/context.ts";

export interface OAuthParams {
  appName?: string;
  org: string;
  project: string;
  integrationId: string;
}

export interface WithOAuthOptions {
  hono: Hono<AppEnv>;
  mcpEndpoint: string;
  getOAuthParams?: (c: Context<AppEnv>) => OAuthParams | Promise<OAuthParams>;
  /**
   * Builds the MCP resource URL (e.g., "http://localhost:3001/apps/mcp" or "http://localhost:3001/org/project/integrationId/mcp")
   * This URL should NOT include query parameters - it's used for building .well-known paths
   */
  buildMcpUrl?: (baseUrl: string, params: OAuthParams) => string;
  /**
   * Builds the issuer/authorization server base URL (e.g., "http://localhost:3001/apps" or "http://localhost:3001/org/project/integrationId")
   * This is the base URL without the "/mcp" suffix
   */
  buildIssuerUrl?: (baseUrl: string, params: OAuthParams) => string;
}

/**
 * Default implementation: extract OAuth params from URL params
 */
const defaultGetOAuthParams = (c: Context<AppEnv>): OAuthParams => ({
  org: c.req.param("org") ?? "",
  project: c.req.param("project") ?? "",
  integrationId: c.req.param("integrationId") ?? "",
});

/**
 * Default implementation: build standard MCP URL pattern (no query params)
 */
const defaultBuildMcpUrl = (
  baseUrl: string,
  { org, project, integrationId }: OAuthParams,
): string => `${baseUrl}/${org}/${project}/${integrationId}/mcp`;

/**
 * Default implementation: build issuer URL (auth server base URL without /mcp)
 */
const defaultBuildIssuerUrl = (
  baseUrl: string,
  { org, project, integrationId }: OAuthParams,
): string => `${baseUrl}/${org}/${project}/${integrationId}`;

const withoutLeadingSlash = (path: string) => {
  return path.startsWith("/") ? path.slice(1) : path;
};

const withoutTrailingSlash = (path: string) => {
  return path.endsWith("/") ? path.slice(0, -1) : path;
};

const sanitize = (path: string) => {
  return withoutLeadingSlash(withoutTrailingSlash(path));
};

const isListToolsRequest = async (c: Context<AppEnv>) => {
  const clonedReq = c.req.raw.clone();
  try {
    const body = (await clonedReq.json()) as { method?: string };
    // Allow tools/list to pass without auth
    return body?.method === "tools/list";
  } catch {
    // If body parsing fails, require auth
    return false;
  }
};

interface OAuthClient {
  id: string;
  client_id: string;
  client_secret: string | null;
  client_name: string | null;
  client_type: "public" | "confidential";
  redirect_uris: string;
  grant_types: string;
  response_types: string;
  scope: string | null;
  token_endpoint_auth_method: string;
  metadata: string | null;
  disabled: number;
  user_id: string | null;
  created_at: number;
  updated_at: number;
}

const DEFAULT_DB_ORG = "deco-team";
const DEFAULT_DB_PROJECT = "default";
/**
 * Helper to get workspace database with proper exec function
 */
async function getWorkspaceDB(c: Context<AppEnv>) {
  const ctx = honoCtxToAppCtx(c);
  ctx.locator ??= {
    branch: "main",
    org: DEFAULT_DB_ORG,
    project: DEFAULT_DB_PROJECT,
    value: Locator.from({ org: DEFAULT_DB_ORG, project: DEFAULT_DB_PROJECT }),
  };
  ctx.workspace ??= fromWorkspaceString(
    ctx.locator.value.toString(),
    ctx.locator.branch,
  );
  return await workspaceDB(ctx);
}

/**
 * Common metadata fields shared across all discovery endpoints
 */
const COMMON_METADATA = {
  scopes_supported: ["*"],
  response_types_supported: ["code"],
  response_modes_supported: ["query"],
  grant_types_supported: ["authorization_code"],
  subject_types_supported: ["public"],
  id_token_signing_alg_values_supported: ["RS256"],
  token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
  code_challenge_methods_supported: ["S256"],
} as const;

const OIDC_CLAIMS = [
  "sub",
  "iss",
  "aud",
  "exp",
  "iat",
  "email",
  "email_verified",
  "name",
] as const;

/**
 * Build authorization server metadata for a workspace
 */
function buildAuthServerMetadata(
  baseUrl: string,
  org: string,
  project: string,
  integrationId: string,
) {
  return {
    issuer: `${baseUrl}/${org}/${project}/${integrationId}`,
    authorization_endpoint: `${baseUrl}/${org}/${project}/${integrationId}/mcp/authorize`,
    token_endpoint: `${baseUrl}/apps/code-exchange`,
    jwks_uri: `${baseUrl}/.well-known/jwks.json`,
    registration_endpoint: `${baseUrl}/${org}/${project}/${integrationId}/mcp/register`,
    ...COMMON_METADATA,
  };
}

/**
 * Build OIDC discovery metadata for a workspace
 */
function buildOIDCMetadata(
  baseUrl: string,
  org: string,
  project: string,
  integrationId: string,
) {
  return {
    ...buildAuthServerMetadata(baseUrl, org, project, integrationId),
    scopes_supported: ["openid", "profile", "email"],
    claims_supported: OIDC_CLAIMS,
  };
}

/**
 * Build protected resource metadata for a workspace
 */
function buildProtectedResourceMetadata(
  baseUrl: string,
  org: string,
  project: string,
  integrationId: string,
) {
  return {
    resource: `${baseUrl}/${org}/${project}/${integrationId}/mcp`,
    authorization_servers: [`${baseUrl}/${org}/${project}/${integrationId}`],
    jwks_uri: `${baseUrl}/.well-known/jwks.json`,
    scopes_supported: ["*"],
    bearer_methods_supported: ["header"],
    resource_signing_alg_values_supported: ["RS256", "none"],
  };
}

/**
 * Adds MCP OAuth endpoints
 */
export const withOAuth = ({
  hono,
  mcpEndpoint: mcpEndpointParam,
  getOAuthParams = defaultGetOAuthParams,
  buildMcpUrl = defaultBuildMcpUrl,
  buildIssuerUrl = defaultBuildIssuerUrl,
}: WithOAuthOptions) => {
  const mcpEndpoint = `/${sanitize(mcpEndpointParam)}`;
  const withoutMcpEnding = mcpEndpoint.replace("/mcp", "");

  // OAuth path templates (workspace will be in URL path)
  const authorizationEndpoint = `${withoutMcpEnding}/mcp/authorize`;
  const registrationEndpoint = `${withoutMcpEnding}/mcp/register`;

  // Ensure OAuth tables exist on first request
  const tablesEnsured = new WeakMap<object, boolean>();
  const ensureTables = async (c: Context<AppEnv>) => {
    const ctx = honoCtxToAppCtx(c);
    if (!ctx.workspaceDO || tablesEnsured.get(ctx.workspaceDO)) {
      return;
    }
    const db = await getWorkspaceDB(c);
    // Create wrapper that matches the expected signature for ensureOAuthTables
    const runSql = async (params: { sql: string; params: unknown[] }) => {
      using response = await db.exec(params);
      return response;
    };
    await ensureOAuthTables(runSql);
    if (ctx.workspaceDO) {
      tablesEnsured.set(ctx.workspaceDO, true);
    }
  };

  /**
   * Build dynamic authorization server metadata using the URL builders
   */
  const buildDynamicAuthServerMetadata = (
    baseUrl: string,
    params: OAuthParams,
  ) => {
    const issuerUrl = buildIssuerUrl(baseUrl, params);
    const mcpUrl = buildMcpUrl(baseUrl, params);
    return {
      issuer: issuerUrl,
      authorization_endpoint: `${mcpUrl}/authorize`,
      token_endpoint: `${baseUrl}/apps/code-exchange`,
      jwks_uri: `${baseUrl}/.well-known/jwks.json`,
      registration_endpoint: `${mcpUrl}/register`,
      ...COMMON_METADATA,
    };
  };

  /**
   * Build dynamic protected resource metadata using the URL builders
   */
  const buildDynamicProtectedResourceMetadata = (
    baseUrl: string,
    params: OAuthParams,
  ) => {
    const issuerUrl = buildIssuerUrl(baseUrl, params);
    const mcpUrl = buildMcpUrl(baseUrl, params);
    return {
      resource: mcpUrl,
      authorization_servers: [issuerUrl],
      jwks_uri: `${baseUrl}/.well-known/jwks.json`,
      scopes_supported: ["*"],
      bearer_methods_supported: ["header"],
      resource_signing_alg_values_supported: ["RS256", "none"],
    };
  };

  /**
   * Build dynamic OIDC metadata using the URL builders
   */
  const buildDynamicOIDCMetadata = (baseUrl: string, params: OAuthParams) => {
    return {
      ...buildDynamicAuthServerMetadata(baseUrl, params),
      scopes_supported: ["openid", "profile", "email"],
      claims_supported: OIDC_CLAIMS,
    };
  };

  // ============================================================
  // IMPORTANT: All .well-known routes MUST be registered BEFORE
  // the main MCP endpoint, because /:org/:project/:integrationId/mcp
  // can match paths like /.well-known/oauth-protected-resource/apps/mcp
  // ============================================================

  // Path-insertion pattern routes for dynamic endpoint
  // These handle URLs like /.well-known/oauth-protected-resource/apps/mcp
  // MUST be registered BEFORE the main MCP endpoint!
  hono.get(`/.well-known/oauth-protected-resource${mcpEndpoint}`, async (c) => {
    const url = new URL(c.req.url);
    const params = await getOAuthParams(c);
    return Response.json(
      buildDynamicProtectedResourceMetadata(url.origin, params),
    );
  });

  hono.get(
    `/.well-known/oauth-authorization-server${withoutMcpEnding}`,
    async (c) => {
      const url = new URL(c.req.url);
      const params = await getOAuthParams(c);
      return Response.json(buildDynamicAuthServerMetadata(url.origin, params));
    },
  );

  hono.get(
    `/.well-known/openid-configuration${withoutMcpEnding}`,
    async (c) => {
      const url = new URL(c.req.url);
      const params = await getOAuthParams(c);
      return Response.json(buildDynamicOIDCMetadata(url.origin, params));
    },
  );

  // Dynamic protected resource metadata for this endpoint
  hono.get(`${mcpEndpoint}/.well-known/oauth-protected-resource`, async (c) => {
    const url = new URL(c.req.url);
    const params = await getOAuthParams(c);
    return Response.json(
      buildDynamicProtectedResourceMetadata(url.origin, params),
    );
  });

  // Dynamic authorization server metadata for this endpoint
  hono.get(
    `${withoutMcpEnding}/.well-known/oauth-authorization-server`,
    async (c) => {
      const url = new URL(c.req.url);
      const params = await getOAuthParams(c);
      return Response.json(buildDynamicAuthServerMetadata(url.origin, params));
    },
  );

  // Dynamic OIDC discovery for this endpoint
  hono.get(
    `${withoutMcpEnding}/.well-known/openid-configuration`,
    async (c) => {
      const url = new URL(c.req.url);
      const params = await getOAuthParams(c);
      return Response.json(buildDynamicOIDCMetadata(url.origin, params));
    },
  );

  // Protected MCP endpoint - JWT token validation happens in existing middleware
  // NOTE: This is registered AFTER .well-known routes to prevent /:org/:project/:integrationId/mcp
  // from matching paths like /.well-known/oauth-protected-resource/apps/mcp
  hono.all(mcpEndpoint, async (c) => {
    const url = new URL(c.req.url);
    const ctx = honoCtxToAppCtx(c);

    if (!ctx.user && !isListToolsRequest(c)) {
      // Get OAuth params using the provided function
      const params = await getOAuthParams(c);
      // Build resource metadata URL using the MCP URL builder (no query params)
      const mcpUrl = buildMcpUrl(url.origin, params);
      const resourceMetadataUrl = `${mcpUrl}/.well-known/oauth-protected-resource`;
      const wwwAuthenticateValue = `Bearer resource_metadata="${resourceMetadataUrl}", scope="*"`;
      return Response.json(
        {
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Unauthorized: Authentication required",
          },
          id: null,
        },
        {
          status: 401,
          headers: {
            "WWW-Authenticate": wwwAuthenticateValue,
            "Access-Control-Expose-Headers": "WWW-Authenticate",
          },
        },
      );
    }

    // JWT validation is handled by existing middleware (setUserMiddleware)
    // Just proceed to MCP proxy which will use the Authorization header
    const proxy = await createMcpServerProxy(c);
    return proxy.fetch(c.req.raw);
  });

  // Workspace-specific protected resource metadata (RFC9728)
  hono.get(
    `/:org/:project/:integrationId/mcp/.well-known/oauth-protected-resource`,
    async (c) => {
      const url = new URL(c.req.url);
      const org = c.req.param("org");
      const project = c.req.param("project");
      const integrationId = c.req.param("integrationId");
      return Response.json(
        buildProtectedResourceMetadata(url.origin, org, project, integrationId),
      );
    },
  );

  // Path-insertion pattern for protected resource metadata
  hono.get(
    `/.well-known/oauth-protected-resource/:org/:project/:integrationId/mcp`,
    async (c) => {
      const url = new URL(c.req.url);
      const org = c.req.param("org");
      const project = c.req.param("project");
      const integrationId = c.req.param("integrationId");
      return Response.json(
        buildProtectedResourceMetadata(url.origin, org, project, integrationId),
      );
    },
  );

  // Generic protected resource metadata (fallback)
  hono.get(`/.well-known/oauth-protected-resource`, async (c) => {
    const url = new URL(c.req.url);
    const authMetadata = {
      resource: url.origin,
      authorization_servers: [`${url.origin}`],
      jwks_uri: `${url.origin}/.well-known/jwks.json`,
      scopes_supported: ["*"],
      bearer_methods_supported: ["header"],
      resource_signing_alg_values_supported: ["RS256", "none"],
    };
    return Response.json(authMetadata);
  });

  // Workspace-specific authorization server metadata
  hono.get(
    `/:org/:project/:integrationId/.well-known/oauth-authorization-server`,
    async (c) => {
      const url = new URL(c.req.url);
      const org = c.req.param("org");
      const project = c.req.param("project");
      const integrationId = c.req.param("integrationId");
      return Response.json(
        buildAuthServerMetadata(url.origin, org, project, integrationId),
      );
    },
  );

  // Path-insertion pattern for authorization server metadata
  hono.get(
    `/.well-known/oauth-authorization-server/:org/:project/:integrationId`,
    async (c) => {
      const url = new URL(c.req.url);
      const org = c.req.param("org");
      const project = c.req.param("project");
      const integrationId = c.req.param("integrationId");
      return Response.json(
        buildAuthServerMetadata(url.origin, org, project, integrationId),
      );
    },
  );

  // Generic authorization server metadata (fallback)
  hono.get(`/.well-known/oauth-authorization-server`, async (c) => {
    const baseUrl = new URL(c.req.url).origin;
    return Response.json({
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/mcp/authorize`,
      token_endpoint: `${baseUrl}/apps/code-exchange`,
      jwks_uri: `${baseUrl}/.well-known/jwks.json`,
      registration_endpoint: `${baseUrl}/mcp/register`,
      ...COMMON_METADATA,
    });
  });

  // Workspace-specific OIDC discovery
  hono.get(
    `/:org/:project/:integrationId/.well-known/openid-configuration`,
    async (c) => {
      const url = new URL(c.req.url);
      const org = c.req.param("org");
      const project = c.req.param("project");
      const integrationId = c.req.param("integrationId");
      return Response.json(
        buildOIDCMetadata(url.origin, org, project, integrationId),
      );
    },
  );

  // Path-insertion pattern for OIDC discovery
  hono.get(
    `/.well-known/openid-configuration/:org/:project/:integrationId`,
    async (c) => {
      const url = new URL(c.req.url);
      const org = c.req.param("org");
      const project = c.req.param("project");
      const integrationId = c.req.param("integrationId");
      return Response.json(
        buildOIDCMetadata(url.origin, org, project, integrationId),
      );
    },
  );

  // Generic OIDC discovery (fallback)
  hono.get(`/.well-known/openid-configuration`, async (c) => {
    const baseUrl = new URL(c.req.url).origin;
    return Response.json({
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/mcp/authorize`,
      token_endpoint: `${baseUrl}/apps/code-exchange`,
      jwks_uri: `${baseUrl}/.well-known/jwks.json`,
      registration_endpoint: `${baseUrl}/mcp/register`,
      ...COMMON_METADATA,
      scopes_supported: ["openid", "profile", "email"],
      claims_supported: OIDC_CLAIMS,
    });
  });

  // Dynamic Client Registration (workspace-specific)
  hono.post(registrationEndpoint, async (c) => {
    await ensureTables(c);
    const db = await getWorkspaceDB(c);

    try {
      const body = await c.req.json();

      // Validate required fields
      if (
        (!body.grant_types ||
          body.grant_types.includes("authorization_code") ||
          body.grant_types.includes("implicit")) &&
        (!body.redirect_uris || body.redirect_uris.length === 0)
      ) {
        throw new HTTPException(400, {
          message:
            "Redirect URIs are required for authorization_code and implicit grant types",
        });
      }

      // Validate redirect URIs format
      for (const uri of body.redirect_uris || []) {
        if (!isValidRedirectUriFormat(uri)) {
          throw new HTTPException(400, {
            message: `Invalid redirect URI: ${uri}. Must be HTTPS or localhost`,
          });
        }
      }

      const clientId = generateRandomToken(32);
      const clientType =
        body.token_endpoint_auth_method === "none" ? "public" : "confidential";
      const clientSecret =
        clientType === "confidential" ? generateRandomToken(32) : null;

      const ctx = honoCtxToAppCtx(c);
      const userId = ctx.user?.id as string | undefined;

      using _response = await db.exec({
        sql: `INSERT INTO oauth_clients (
          client_id, client_secret, client_name, client_type, redirect_uris,
          grant_types, response_types, scope, token_endpoint_auth_method,
          metadata, disabled, user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          clientId,
          clientSecret,
          body.client_name || null,
          clientType,
          JSON.stringify(body.redirect_uris),
          JSON.stringify(body.grant_types || ["authorization_code"]),
          JSON.stringify(body.response_types || ["code"]),
          body.scope || null,
          body.token_endpoint_auth_method || "client_secret_basic",
          body.metadata ? JSON.stringify(body.metadata) : null,
          0,
          userId || null,
        ],
      });

      const responseData = {
        client_id: clientId,
        client_id_issued_at: getCurrentTimestamp(),
        redirect_uris: body.redirect_uris,
        token_endpoint_auth_method:
          body.token_endpoint_auth_method || "client_secret_basic",
        grant_types: body.grant_types || ["authorization_code"],
        response_types: body.response_types || ["code"],
        client_name: body.client_name,
        client_uri: body.client_uri,
        logo_uri: body.logo_uri,
        scope: body.scope,
        ...(clientType !== "public"
          ? {
              client_secret: clientSecret,
              client_secret_expires_at: 0,
            }
          : {}),
      };

      return new Response(JSON.stringify(responseData), {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          Pragma: "no-cache",
        },
      });
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }
      console.error("Client registration error:", error);
      throw new HTTPException(500, { message: "Internal server error" });
    }
  });

  // Authorization Endpoint (workspace-specific URL path)
  hono.get(authorizationEndpoint, async (c) => {
    await ensureTables(c);
    const ctx = honoCtxToAppCtx(c);
    const db = await getWorkspaceDB(c);

    // Get OAuth params using the provided function
    const {
      org,
      project,
      integrationId,
      appName: _name,
    } = await getOAuthParams(c);

    const clientId = c.req.query("client_id");
    const redirectUri = c.req.query("redirect_uri");
    const responseType = c.req.query("response_type");
    const scope = c.req.query("scope");
    const clientState = c.req.query("state");
    const codeChallenge = c.req.query("code_challenge");
    const codeChallengeMethod = c.req.query("code_challenge_method");

    // Encode workspace context + client state into combined state
    const state = encodeOAuthState({
      org,
      project,
      integrationId,
      clientState,
    });

    // Validate required parameters
    if (!clientId || !redirectUri || !responseType) {
      throw new HTTPException(400, {
        message: "Missing required parameters",
      });
    }

    if (responseType !== "code") {
      throw new HTTPException(400, {
        message: "Unsupported response_type",
      });
    }

    // Fetch client
    using clientResponse = await db.exec({
      sql: "SELECT * FROM oauth_clients WHERE client_id = ? LIMIT 1",
      params: [clientId],
    });

    const clientResults = clientResponse.result[0]?.results as unknown[];
    const client = clientResults?.[0] as OAuthClient | undefined;

    if (!client || client.disabled) {
      throw new HTTPException(400, { message: "Invalid client_id" });
    }

    // Validate redirect URI
    const registeredUris = JSON.parse(client.redirect_uris) as string[];
    if (!validateRedirectUri(redirectUri, registeredUris)) {
      throw new HTTPException(400, { message: "Invalid redirect_uri" });
    }

    // Check if PKCE is required for public clients
    if (client.client_type === "public" && !codeChallenge) {
      throw new HTTPException(400, {
        message: "code_challenge is required for public clients",
      });
    }

    // Fetch integration to get app_name
    let appName: string | undefined = _name;
    if (!appName) {
      try {
        const proxy = await createMcpServerProxy(c, integrationId);
        const integration = await proxy.fetchIntegration();
        appName = integration?.appName ?? undefined;
      } catch {
        appName = client.client_name || undefined;
      }
    }

    // Redirect to apps-auth consent page (which will handle login if needed)
    const consentUrl = new URL(`${DECO_CMS_WEB_URL}/apps-auth`);
    consentUrl.searchParams.set("client_id", clientId);
    consentUrl.searchParams.set("redirect_uri", redirectUri);
    consentUrl.searchParams.set("scope", scope || "*");
    consentUrl.searchParams.set("state", state); // Encoded workspace + client state
    consentUrl.searchParams.set("mode", "proxy");
    ctx.workspace?.value &&
      consentUrl.searchParams.set("workspace_hint", ctx.workspace.value);
    org && consentUrl.searchParams.set("org", org);
    project && consentUrl.searchParams.set("project", project);
    integrationId &&
      consentUrl.searchParams.set("integrationId", integrationId);
    if (appName) {
      consentUrl.searchParams.set("app_name", appName);
    }
    if (codeChallenge) {
      consentUrl.searchParams.set("code_challenge", codeChallenge);
    }
    if (codeChallengeMethod) {
      consentUrl.searchParams.set("code_challenge_method", codeChallengeMethod);
    }

    return c.redirect(consentUrl.toString());
  });

  // Note: Token exchange is handled by existing /apps/code-exchange endpoint
  // Clients should POST to /apps/code-exchange with { code, client_id } to get JWT tokens
};

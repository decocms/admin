import type { OAuthClient, OAuthConfig, OAuthParams } from "./tools.ts";

/**
 * Generate a cryptographically secure random token
 */
function generateRandomToken(length = 32): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join("");
}

/**
 * Validate redirect URI format per OAuth 2.1
 */
function isValidRedirectUri(uri: string): boolean {
  try {
    const url = new URL(uri);
    return (
      url.protocol === "https:" ||
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      // Allow custom schemes for native apps (e.g., cursor://, vscode://)
      !url.protocol.startsWith("http")
    );
  } catch {
    return false;
  }
}

/**
 * Create OAuth endpoint handlers for MCP servers
 * Per MCP Authorization spec: https://modelcontextprotocol.io/specification/draft/basic/authorization
 */
export function createOAuthHandlers(oauth: OAuthConfig) {
  /**
   * Build OAuth 2.0 Protected Resource Metadata (RFC9728)
   * Per MCP spec, this MUST point to the external authorization server
   */
  const handleProtectedResourceMetadata = (req: Request): Response => {
    const url = new URL(req.url);
    const resourceUrl = `${url.origin}/mcp`;

    return Response.json({
      resource: resourceUrl,
      authorization_servers: [oauth.authorizationServer],
      scopes_supported: ["*"],
      bearer_methods_supported: ["header"],
      resource_signing_alg_values_supported: ["RS256", "none"],
    });
  };

  /**
   * Handle OAuth callback - receives code from external OAuth provider
   */
  const handleOAuthCallback = async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const codeVerifier = url.searchParams.get("code_verifier") ?? undefined;
    const codeChallengeMethod = url.searchParams.get("code_challenge_method") as
      | "S256"
      | "plain"
      | undefined;

    if (!code) {
      return Response.json(
        {
          error: "invalid_request",
          error_description: "Missing code parameter",
        },
        { status: 400 },
      );
    }

    try {
      const oauthParams: OAuthParams = {
        code,
        code_verifier: codeVerifier,
        code_challenge_method: codeChallengeMethod,
      };
      const tokenResponse = await oauth.exchangeCode(oauthParams);

      return Response.json(tokenResponse, {
        headers: {
          "Cache-Control": "no-store",
          Pragma: "no-cache",
        },
      });
    } catch (error) {
      console.error("OAuth code exchange error:", error);
      return Response.json(
        {
          error: "invalid_grant",
          error_description: "Failed to exchange authorization code",
        },
        { status: 400 },
      );
    }
  };

  /**
   * Handle dynamic client registration (RFC7591)
   */
  const handleClientRegistration = async (req: Request): Promise<Response> => {
    try {
      const body = (await req.json()) as {
        redirect_uris?: string[];
        client_name?: string;
        grant_types?: string[];
        response_types?: string[];
        token_endpoint_auth_method?: string;
        scope?: string;
      };

      // Validate redirect URIs
      if (!body.redirect_uris || body.redirect_uris.length === 0) {
        return Response.json(
          {
            error: "invalid_redirect_uri",
            error_description: "At least one redirect_uri is required",
          },
          { status: 400 },
        );
      }

      for (const uri of body.redirect_uris) {
        if (!isValidRedirectUri(uri)) {
          return Response.json(
            {
              error: "invalid_redirect_uri",
              error_description: `Invalid redirect URI: ${uri}`,
            },
            { status: 400 },
          );
        }
      }

      const clientId = generateRandomToken(32);
      const clientSecret =
        body.token_endpoint_auth_method !== "none"
          ? generateRandomToken(32)
          : undefined;
      const now = Math.floor(Date.now() / 1000);

      const client: OAuthClient = {
        client_id: clientId,
        client_secret: clientSecret,
        client_name: body.client_name,
        redirect_uris: body.redirect_uris,
        grant_types: body.grant_types ?? ["authorization_code"],
        response_types: body.response_types ?? ["code"],
        token_endpoint_auth_method:
          body.token_endpoint_auth_method ?? "client_secret_post",
        scope: body.scope,
        client_id_issued_at: now,
        client_secret_expires_at: 0,
      };

      // Save client if persistence is provided
      if (oauth.persistence) {
        await oauth.persistence.saveClient(client);
      }

      return new Response(JSON.stringify(client), {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          Pragma: "no-cache",
        },
      });
    } catch (error) {
      console.error("Client registration error:", error);
      return Response.json(
        {
          error: "invalid_client_metadata",
          error_description: "Invalid client registration request",
        },
        { status: 400 },
      );
    }
  };

  /**
   * Return 401 with WWW-Authenticate header for unauthenticated MCP requests
   * Per MCP spec: MUST include resource_metadata URL
   */
  const createUnauthorizedResponse = (req: Request): Response => {
    const url = new URL(req.url);
    const resourceMetadataUrl = `${url.origin}/.well-known/oauth-protected-resource`;
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
  };

  /**
   * Check if request has authentication token
   */
  const hasAuth = (req: Request): boolean => {
    const authHeader = req.headers.get("Authorization");
    const meshToken = req.headers.get("x-mesh-token");
    return !!(authHeader || meshToken);
  };

  return {
    handleProtectedResourceMetadata,
    handleOAuthCallback,
    handleClientRegistration,
    createUnauthorizedResponse,
    hasAuth,
  };
}

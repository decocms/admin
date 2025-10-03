import { z } from "zod";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import { createToolGroup } from "../context.ts";
import { MCPClient } from "../index.ts";
import { decodeJwt } from "jose";
import { InlineAppSchema } from "../../models/mcp.ts";

const createTool = createToolGroup("OAuth", {
  name: "OAuth Management",
  description: "Create and manage OAuth codes securely.",
  icon: "https://assets.decocache.com/mcp/5e6930c3-86f6-4913-8de3-0c1fefdf02e3/API-key.png",
});

export const oauthCodeCreate = createTool({
  name: "OAUTH_CODE_CREATE",
  description:
    "Create an OAuth code for a given API key or inline app and return the full callback URI",
  inputSchema: z
    .object({
      integrationId: z
        .string()
        .describe("The ID of the integration to create an OAuth code for")
        .optional(),
      inlineApp: InlineAppSchema.describe(
        "The inline app configuration (for localhost development)",
      ).optional(),
      redirect_uri: z
        .string()
        .url()
        .describe(
          "The redirect URI where the user will be sent with the OAuth code",
        ),
    })
    .refine(
      (data) => {
        // Exactly one of integrationId or inlineApp must be provided
        return (
          (data.integrationId && !data.inlineApp) ||
          (!data.integrationId && data.inlineApp)
        );
      },
      {
        message:
          "Either integrationId or inlineApp must be provided, but not both",
      },
    )
    .refine(
      (data) => {
        // Inline apps can only redirect to localhost
        if (data.inlineApp) {
          try {
            const url = new URL(data.redirect_uri);
            return url.hostname === "localhost";
          } catch {
            return false;
          }
        }
        return true;
      },
      {
        message: "Inline apps can only redirect to localhost URLs",
        path: ["redirect_uri"],
      },
    ),
  outputSchema: z.object({
    callback_uri: z
      .string()
      .describe(
        "The full callback URI with the OAuth code as a query parameter",
      ),
  }),
  handler: async ({ integrationId, inlineApp, redirect_uri }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    let claims = {};

    if (inlineApp) {
      // For inline apps (localhost), generate JWT directly without creating an integration
      const issuer = await c.jwtIssuer();

      const jwtClaims = {
        sub: c.workspace.value,
        workspace: c.workspace.value,
        appName: "localhost-app",
        user: c.user,
      };

      const token = await issuer.issue(jwtClaims);

      // Claims include the JWT token and connection info
      claims = {
        ...jwtClaims,
        user: JSON.stringify(c.user),
        token, // The JWT that will be returned on code exchange
        connection: inlineApp.connection, // Store connection for reference
      };
    } else {
      // Regular flow: use existing integration
      const mcpClient = MCPClient.forContext(c);
      const integration = await mcpClient.INTEGRATIONS_GET({
        id: integrationId!,
      });
      const connection = integration.connection;
      if (connection.type !== "HTTP" || !connection.token) {
        throw new Error(
          "Only authorized HTTP connections are supported for OAuth codes",
        );
      }
      const currentClaims = decodeJwt(connection.token);
      claims = {
        ...currentClaims,
        user: JSON.stringify(c.user),
      };
    }

    const code = crypto.randomUUID();

    const { error } = await c.db.from("deco_chat_oauth_codes").insert({
      code,
      claims,
      workspace: c.workspace.value,
    });
    if (error) {
      throw new Error(error.message);
    }

    // Build the full callback URI with the code as a query parameter
    const callbackUrl = new URL(redirect_uri);
    callbackUrl.searchParams.set("code", code);
    const callback_uri = callbackUrl.toString();

    return {
      callback_uri,
    };
  },
});

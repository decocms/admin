/**
 * Better Auth Configuration for MCP Mesh
 *
 * Provides:
 * - MCP OAuth 2.1 server (via MCP plugin)
 * - API Key management (via API Key plugin)
 * - Role-based access control (via Admin plugin)
 *
 * Configuration is file-based (auth-config.json), not environment variables.
 */

import { getToolsByCategory } from "@/tools/registry";
import { sso } from "@better-auth/sso";
import { betterAuth, BetterAuthOptions } from "better-auth";
import {
  admin as adminPlugin,
  apiKey,
  jwt,
  magicLink,
  mcp,
  openAPI,
  organization,
  OrganizationOptions,
} from "better-auth/plugins";
import {
  adminAc,
  defaultStatements,
} from "better-auth/plugins/organization/access";

import { createAccessControl, Role } from "better-auth/plugins/access";
import { existsSync, readFileSync } from "fs";
import {
  createEmailSender,
  EmailProviderConfig,
  findEmailProvider,
} from "./email-providers";
import { createMagicLinkConfig, MagicLinkConfig } from "./magic-link";
import { createSSOConfig, SSOConfig } from "./sso";
import { getDatabaseUrl, getDbDialect, getDb } from "../database";
import { addDefaultRegistry } from "./organization-hooks";

const DEFAULT_AUTH_CONFIG: Partial<BetterAuthOptions> = {
  emailAndPassword: {
    enabled: true,
  },
};

/**
 * Load optional auth configuration from file
 */
function loadAuthConfig(): Partial<BetterAuthOptions> {
  const configPath = "./auth-config.json";

  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, "utf-8");
      return JSON.parse(content);
    } catch {
      return DEFAULT_AUTH_CONFIG;
    }
  }

  return DEFAULT_AUTH_CONFIG;
}

const allTools = Object.values(getToolsByCategory())
  .map((tool) => tool.map((t) => t.name))
  .flat();
const statement = { ...defaultStatements, self: ["*", ...allTools] };

const ac = createAccessControl(statement);

const user = ac.newRole({
  self: ["*"],
  ...adminAc.statements,
}) as Role;

const admin = ac.newRole({
  self: ["*"],
  ...adminAc.statements,
}) as Role;

const owner = ac.newRole({
  self: ["*"],
  ...adminAc.statements,
}) as Role;

const scopes = Object.values(getToolsByCategory())
  .map((tool) => tool.map((t) => `self:${t.name}`))
  .flat();

export const authConfig: Partial<BetterAuthOptions> & {
  ssoConfig?: SSOConfig;
  magicLinkConfig?: MagicLinkConfig;
  emailProviders?: EmailProviderConfig[];
  inviteEmailProviderId?: string;
  jwt?: { secret?: string };
} = loadAuthConfig();

let sendInvitationEmail: OrganizationOptions["sendInvitationEmail"] = undefined;

// Configure invitation emails if provider is set
if (
  authConfig.inviteEmailProviderId &&
  authConfig.emailProviders &&
  authConfig.emailProviders.length > 0
) {
  const inviteProvider = findEmailProvider(
    authConfig.emailProviders,
    authConfig.inviteEmailProviderId,
  );

  if (inviteProvider) {
    const sendEmail = createEmailSender(inviteProvider);

    sendInvitationEmail = async (data) => {
      const inviterName = data.inviter.user?.name || data.inviter.user?.email;
      const acceptUrl = `${process.env.BASE_URL || "http://localhost:3000"}/auth/accept-invitation?invitationId=${data.invitation.id}`;

      await sendEmail({
        to: data.email,
        subject: `Invitation to join ${data.organization.name}`,
        html: `
          <h2>You've been invited!</h2>
          <p>${inviterName} has invited you to join <strong>${data.organization.name}</strong>.</p>
          <p><a href="${acceptUrl}">Click here to accept the invitation</a></p>
        `,
      });
    };
  }
}

const plugins = [
  // Organization plugin for multi-tenant organization management
  // https://www.better-auth.com/docs/plugins/organization
  organization({
    ac,
    creatorRole: "owner",
    allowUserToCreateOrganization: true, // Users can create organizations by default
    dynamicAccessControl: {
      enabled: true,
      maximumRolesPerOrganization: 500,
    },
    roles: {
      user,
      admin,
      owner,
    },
    sendInvitationEmail,
  }),

  // MCP plugin for OAuth 2.1 server
  // https://www.better-auth.com/docs/plugins/mcp
  mcp({
    loginPage: "/auth/sign-in",
    // Note: Authorization page (/authorize) is served as static HTML
    // Better Auth will redirect there based on loginPage flow
    oidcConfig: {
      scopes: scopes,
      metadata: { scopes_supported: scopes },
      loginPage: "/auth/sign-in",
    },
  }),

  // API Key plugin for direct tool access
  // https://www.better-auth.com/docs/plugins/api-key
  apiKey({
    enableMetadata: true,
    maximumNameLength: 64,
    keyExpiration: {
      minExpiresIn: 5 / 1440, // 5 minutes in days (default is 1 day)
    },
    permissions: {
      defaultPermissions: {
        self: [
          "ORGANIZATION_LIST",
          "ORGANIZATION_GET", // Organization read access
          "ORGANIZATION_MEMBER_LIST", // Member read access
          "COLLECTION_CONNECTIONS_LIST",
          "COLLECTION_CONNECTIONS_GET", // Connection read access
        ],
      },
    },
  }),

  // Admin plugin for system-level super-admins
  // https://www.better-auth.com/docs/plugins/admin
  adminPlugin({
    defaultRole: "user",
    adminRoles: ["admin", "owner"],
  }),

  // OpenAPI plugin for API documentation
  // https://www.better-auth.com/docs/plugins/openAPI
  openAPI(),

  // JWT plugin for issuing tokens with custom payloads
  // https://www.better-auth.com/docs/plugins/jwt
  // Used by proxy routes to issue short-lived tokens with connection metadata
  jwt({
    jwt: {
      // Short expiration for proxy tokens (5 minutes)
      expirationTime: "5m",
    },
  }),

  sso(authConfig.ssoConfig ? createSSOConfig(authConfig.ssoConfig) : undefined),

  ...(authConfig.magicLinkConfig &&
  authConfig.emailProviders &&
  authConfig.emailProviders.length > 0
    ? [
        magicLink(
          createMagicLinkConfig(
            authConfig.magicLinkConfig,
            authConfig.emailProviders,
          ),
        ),
      ]
    : []),
];

const databaseUrl = getDatabaseUrl();

// Get dialect without creating the full Kysely instance
// Better Auth can use the dialect directly
const database = getDbDialect(databaseUrl);

/**
 * Better Auth instance with MCP, API Key, and Admin plugins
 */
export const auth = betterAuth({
  // Base URL for OAuth - will be overridden by request context
  baseURL: process.env.BASE_URL || "http://localhost:3000",

  // Better Auth can use the dialect directly
  database,

  emailAndPassword: {
    enabled: true,
  },

  // Load optional configuration from file
  ...authConfig,

  plugins,

  // Hooks to auto-provision resources when organizations are created
  hooks: {
    organization: {
			create: {
				after: async (organization) => {
					// Get the creator's user ID from the organization members
					const db = getDb();
					const member = await db
            .selectFrom("member")
            .select("userId")
            .where("organizationId", "=", organization.id)
            .where("role", "=", "owner")
            .executeTakeFirst();

          if (member?.userId) {
            // Add default Deco Store registry
            await addDefaultRegistry(organization.id, member.userId);
          }
        },
      },
    },
  },
});

export type BetterAuthInstance = typeof auth;

// ============================================================================
// Helper Functions
// ============================================================================

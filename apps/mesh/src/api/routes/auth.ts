/**
 * Custom Auth Routes
 *
 * Provides custom authentication endpoints that work better with OAuth flows
 * by returning callback URLs in response body instead of using 302 redirects.
 */

import { Hono } from "hono";
import { authConfig } from "../../auth";
import { KNOWN_OAUTH_PROVIDERS, OAuthProvider } from "@/auth/oauth-providers";

const app = new Hono();

export type AuthConfig = {
  emailAndPassword: {
    enabled: boolean;
  };
  magicLink: {
    enabled: boolean;
  };
  socialProviders: {
    enabled: boolean;
    providers: {
      name: string;
      icon?: string;
    }[];
  };
  sso:
    | {
        enabled: true;
        providerId: string;
      }
    | {
        enabled: false;
      };
};

/**
 * Auth Configuration Endpoint
 *
 * Returns information about available authentication methods
 *
 * Route: GET /api/auth/custom/config
 */
app.get("/config", async (c) => {
  try {
    const socialProviders = Object.keys(authConfig.socialProviders ?? {});
    const hasSocialProviders = socialProviders.length > 0;
    const providers = socialProviders.map((name) => ({
      name,
      icon: KNOWN_OAUTH_PROVIDERS[name as OAuthProvider].icon,
    }));

    const config: AuthConfig = {
      emailAndPassword: {
        enabled: authConfig.emailAndPassword?.enabled ?? false,
      },
      magicLink: {
        enabled: authConfig.magicLinkConfig?.enabled ?? false,
      },
      socialProviders: {
        enabled: hasSocialProviders,
        providers: providers,
      },
      sso: authConfig.ssoConfig
        ? {
            enabled: true,
            providerId: authConfig.ssoConfig.providerId,
          }
        : {
            enabled: false,
          },
    };

    return c.json({ success: true, config });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to load auth config";

    return c.json(
      {
        success: false,
        error: errorMessage,
      },
      500,
    );
  }
});

export default app;

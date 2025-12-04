import { EmailProviderConfig } from "@/auth/email-providers";
import { MagicLinkConfig } from "@/auth/magic-link";
import { SSOConfig } from "@/auth/sso";
import { BetterAuthOptions } from "better-auth";
import { existsSync, readFileSync } from "fs";

const DEFAULT_AUTH_CONFIG: Partial<BetterAuthOptions> = {
  emailAndPassword: {
    enabled: true,
  },
};
export interface Config {
  auth: Partial<BetterAuthOptions> & {
    ssoConfig?: SSOConfig;
    magicLinkConfig?: MagicLinkConfig;
    emailProviders?: EmailProviderConfig[];
    inviteEmailProviderId?: string;
    jwt?: { secret?: string };
  };
}

export const config = loadConfig();

const configPath = "./config.json";
const authConfigPath = "./auth-config.json";
/**
 * Load optional auth configuration from file
 */
export function loadConfig(): Config {
  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, "utf-8");
      return { auth: DEFAULT_AUTH_CONFIG, ...JSON.parse(content) };
    } catch {
      return { auth: DEFAULT_AUTH_CONFIG };
    }
  }

  if (existsSync(authConfigPath)) {
    try {
      const content = readFileSync(authConfigPath, "utf-8");
      return { auth: JSON.parse(content) };
    } catch {
      return { auth: DEFAULT_AUTH_CONFIG };
    }
  }

  return { auth: DEFAULT_AUTH_CONFIG };
}

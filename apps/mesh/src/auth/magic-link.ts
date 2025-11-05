import type { magicLink } from "better-auth/plugins";
import { Resend } from "./known-email-providers";

type BetterAuthMagicLinkConfig = Parameters<typeof magicLink>[0];

export const createMagicLinkConfig = (
  config: MagicLinkConfig,
): BetterAuthMagicLinkConfig => {
  if (config.provider === "resend") {
    return {
      sendMagicLink: async ({ email, url }) => {
        const resend = new Resend(config.resend.apiKey);

        await resend.sendEmail({
          to: email,
          from: config.resend.fromEmail,
          subject: "Magic Link",
          html: `<p>Click <a href="${url}">here</a> to login</p>`,
        });
      },
    };
  }

  throw new Error(`Invalid magic link provider: ${config.provider}`);
};

interface BaseMagicLinkConfig {
  enabled: boolean;
}

interface ResendMagicLinkConfig extends BaseMagicLinkConfig {
  provider: "resend";
  resend: {
    apiKey: string;
    fromEmail: string;
  };
}

export type MagicLinkConfig = ResendMagicLinkConfig;

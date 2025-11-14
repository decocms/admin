import type { magicLink } from "better-auth/plugins";
import {
  createEmailSender,
  EmailProviderConfig,
  findEmailProvider,
} from "./email-providers";

type BetterAuthMagicLinkConfig = Parameters<typeof magicLink>[0];

export const createMagicLinkConfig = (
  config: MagicLinkConfig,
  emailProviders: EmailProviderConfig[],
): BetterAuthMagicLinkConfig => {
  const provider = findEmailProvider(emailProviders, config.emailProviderId);

  if (!provider) {
    throw new Error(
      `Email provider with id '${config.emailProviderId}' not found`,
    );
  }

  const sendEmail = createEmailSender(provider);

  return {
    sendMagicLink: async ({ email, url }) => {
      await sendEmail({
        to: email,
        subject: "Magic Link",
        html: `<p>Click <a href="${url}">here</a> to login</p>`,
      });
    },
  };
};

export interface MagicLinkConfig {
  enabled: boolean;
  emailProviderId: string;
}

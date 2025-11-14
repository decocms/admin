/**
 * Email Provider Configuration
 *
 * Centralized email provider setup that can be used by:
 * - Magic Link authentication
 * - Organization invitations
 * - Other email-based features
 */

import { Resend } from "./known-email-providers";

export interface EmailProviderConfig {
  id: string;
  provider: "resend";
  config: {
    apiKey: string;
    fromEmail: string;
  };
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

/**
 * Get an email sender function from a provider config
 */
export function createEmailSender(
  providerConfig: EmailProviderConfig,
): (params: SendEmailParams) => Promise<void> {
  if (providerConfig.provider === "resend") {
    const resend = new Resend(providerConfig.config.apiKey);

    return async ({ to, subject, html }: SendEmailParams) => {
      await resend.sendEmail({
        to,
        from: providerConfig.config.fromEmail,
        subject,
        html,
      });
    };
  }

  throw new Error(`Unknown email provider: ${providerConfig.provider}`);
}

/**
 * Find an email provider by ID
 */
export function findEmailProvider(
  providers: EmailProviderConfig[],
  id: string,
): EmailProviderConfig | undefined {
  return providers.find((p) => p.id === id);
}

/**
 * Email Provider Configuration
 *
 * Centralized email provider setup that can be used by:
 * - Magic Link authentication
 * - Organization invitations
 * - Other email-based features
 */

import { Resend, SendGrid } from "./known-email-providers";

// Provider-specific config types
interface ResendConfig {
  apiKey: string;
  fromEmail: string;
}

interface SendGridConfig {
  apiKey: string;
  fromEmail: string;
}

// Discriminated union for email provider config
export type EmailProviderConfig =
  | {
      id: string;
      provider: "resend";
      config: ResendConfig;
    }
  | {
      id: string;
      provider: "sendgrid";
      config: SendGridConfig;
    };

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

// Provider factory function type
type ProviderFactory<T extends EmailProviderConfig> = (
  providerConfig: T,
) => (params: SendEmailParams) => Promise<void>;

// Strongly typed provider factories
const createResendSender: ProviderFactory<
  Extract<EmailProviderConfig, { provider: "resend" }>
> = (providerConfig) => {
  const resend = new Resend(providerConfig.config.apiKey);
  return async ({ to, subject, html }: SendEmailParams) => {
    await resend.sendEmail({
      to,
      from: providerConfig.config.fromEmail,
      subject,
      html,
    });
  };
};

const createSendGridSender: ProviderFactory<
  Extract<EmailProviderConfig, { provider: "sendgrid" }>
> = (providerConfig) => {
  const sendGrid = new SendGrid(providerConfig.config.apiKey);
  return async ({ to, subject, html }: SendEmailParams) => {
    await sendGrid.sendEmail({
      to,
      from: providerConfig.config.fromEmail,
      subject,
      html,
    });
  };
};

// Strongly typed provider map
const providers: {
  [K in EmailProviderConfig["provider"]]: ProviderFactory<
    Extract<EmailProviderConfig, { provider: K }>
  >;
} = {
  resend: createResendSender,
  sendgrid: createSendGridSender,
};

/**
 * Get an email sender function from a provider config
 */
export function createEmailSender(
  providerConfig: EmailProviderConfig,
): (params: SendEmailParams) => Promise<void> {
  const factory = providers[providerConfig.provider];
  if (!factory) {
    throw new Error(`Unknown email provider: ${providerConfig.provider}`);
  }
  // Type assertion is safe here because we're using discriminated union
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return factory(providerConfig as any);
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

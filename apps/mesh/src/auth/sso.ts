export interface MicrosoftSSOConfig {
  domain: string;
  providerId: "microsoft";
  MS_TENANT_ID: string;
  MS_CLIENT_ID: string;
  MS_CLIENT_SECRET: string;
  scopes: string[];
}

const createMicrosoftSSO = (config: MicrosoftSSOConfig) => {
  return {
    defaultSSO: [
      {
        domain: config.domain,
        providerId: config.providerId,
        oidcConfig: {
          issuer: `https://login.microsoftonline.com/${config.MS_TENANT_ID}/v2.0`,
          pkce: true,
          clientId: config.MS_CLIENT_ID,
          clientSecret: config.MS_CLIENT_SECRET,
          discoveryEndpoint: `https://login.microsoftonline.com/${config.MS_TENANT_ID}/v2.0/.well-known/openid-configuration`,
          authorizationEndpoint: `https://login.microsoftonline.com/${config.MS_TENANT_ID}/oauth2/v2.0/authorize`,
          tokenEndpoint: `https://login.microsoftonline.com/${config.MS_TENANT_ID}/oauth2/v2.0/token`,
          jwksEndpoint: `https://login.microsoftonline.com/${config.MS_TENANT_ID}/discovery/v2.0/keys`,
          userInfoEndpoint: "https://graph.microsoft.com/oidc/userinfo",
          tokenEndpointAuthentication: "client_secret_post" as const,
          scopes: config.scopes,
          mapping: {
            id: "sub", // sub é o identificador único do usuário
            email: "email", // claim 'email' existe no discovery
            emailVerified: "email_verified", // se estiver presente
            name: "name", // normalmente 'name' ou 'preferred_username'
            image: "picture", // opcional, pode não existir
            extraFields: {
              emailVerified: "email_verified",
            },
          },
        },
      },
    ],
  };
};

export const createSSOConfig = (config: SSOConfig) => {
  if (config.providerId === "microsoft") {
    return createMicrosoftSSO(config);
  }
  throw new Error(`Unsupported provider: ${config.providerId}`);
};

export type SSOConfig = MicrosoftSSOConfig;

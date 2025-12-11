import {
  OAuthClientInformation,
  OAuthTokens,
  OAuthClientMetadata,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import { auth } from "@modelcontextprotocol/sdk/client/auth.js";
import { sanitizeUrl } from "strict-url-sanitise";

interface StoredState {
  serverUrlHash: string;
  expiry: number;
  providerOptions: {
    serverUrl: string;
    storageKeyPrefix?: string;
    clientName?: string;
    clientUri?: string;
    callbackUrl?: string;
  };
}

export interface AuthResult {
  token: string | null;
  loading: boolean;
  error: string | null;
}

class BrowserOAuthClientProvider implements OAuthClientProvider {
  readonly serverUrl: string;
  readonly storageKeyPrefix: string;
  readonly serverUrlHash: string;
  readonly clientName: string;
  readonly clientUri: string;
  readonly callbackUrl: string;
  private preventAutoAuth?: boolean;
  readonly onPopupWindow:
    | ((url: string, features: string, window: Window | null) => void)
    | undefined;

  constructor(
    serverUrl: string,
    options: {
      storageKeyPrefix?: string;
      clientName?: string;
      clientUri?: string;
      callbackUrl?: string;
      preventAutoAuth?: boolean;
      onPopupWindow?: (
        url: string,
        features: string,
        window: Window | null,
      ) => void;
    } = {},
  ) {
    this.serverUrl = serverUrl;
    this.storageKeyPrefix = options.storageKeyPrefix || "mcp:auth";
    this.serverUrlHash = this.hashString(serverUrl);
    this.clientName = options.clientName || "MCP Browser Client";
    this.clientUri =
      options.clientUri ||
      (typeof window !== "undefined" ? window.location.origin : "");
    this.callbackUrl = sanitizeUrl(
      options.callbackUrl ||
        (typeof window !== "undefined"
          ? new URL("/oauth/callback", window.location.origin).toString()
          : "/oauth/callback"),
    );
    this.preventAutoAuth = options.preventAutoAuth;
    this.onPopupWindow = options.onPopupWindow;
  }

  get redirectUrl(): string {
    return sanitizeUrl(this.callbackUrl);
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      redirect_uris: [this.redirectUrl],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      client_name: this.clientName,
      client_uri: this.clientUri,
    };
  }

  async clientInformation(): Promise<OAuthClientInformation | undefined> {
    const key = this.getKey("client_info");
    const data = localStorage.getItem(key);
    if (!data) return undefined;
    try {
      return JSON.parse(data) as OAuthClientInformation;
    } catch (e) {
      console.warn(
        `[${this.storageKeyPrefix}] Failed to parse client information:`,
        e,
      );
      localStorage.removeItem(key);
      return undefined;
    }
  }

  // NOTE: The SDK's auth() function uses this if dynamic registration is needed.
  // Ensure your OAuthClientInformationFull matches the expected structure if DCR is used.
  async saveClientInformation(
    clientInformation: OAuthClientInformation,
  ): Promise<void> {
    const key = this.getKey("client_info");
    localStorage.setItem(key, JSON.stringify(clientInformation));
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    const key = this.getKey("tokens");
    const data = localStorage.getItem(key);
    if (!data) return undefined;
    try {
      return JSON.parse(data) as OAuthTokens;
    } catch (e) {
      console.warn(`[${this.storageKeyPrefix}] Failed to parse tokens:`, e);
      localStorage.removeItem(key);
      return undefined;
    }
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    const key = this.getKey("tokens");
    localStorage.setItem(key, JSON.stringify(tokens));
    // Clean up code verifier and last auth URL after successful token save
    localStorage.removeItem(this.getKey("code_verifier"));
    localStorage.removeItem(this.getKey("last_auth_url"));
  }

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    const key = this.getKey("code_verifier");
    localStorage.setItem(key, codeVerifier);
  }

  async codeVerifier(): Promise<string> {
    const key = this.getKey("code_verifier");
    const verifier = localStorage.getItem(key);
    if (!verifier) {
      throw new Error(
        `[${this.storageKeyPrefix}] Code verifier not found in storage for key ${key}. Auth flow likely corrupted or timed out.`,
      );
    }
    return verifier;
  }

  async prepareAuthorizationUrl(authorizationUrl: URL): Promise<string> {
    // Generate a unique state parameter for this authorization request
    const state = crypto.randomUUID();
    const stateKey = `${this.storageKeyPrefix}:state_${state}`;

    const stateData: StoredState = {
      serverUrlHash: this.serverUrlHash,
      expiry: Date.now() + 1000 * 60 * 10,
      providerOptions: {
        serverUrl: this.serverUrl,
        storageKeyPrefix: this.storageKeyPrefix,
        clientName: this.clientName,
        clientUri: this.clientUri,
        callbackUrl: this.callbackUrl,
      },
    };
    localStorage.setItem(stateKey, JSON.stringify(stateData));

    authorizationUrl.searchParams.set("state", state);
    const authUrlString = authorizationUrl.toString();

    const sanitizedAuthUrl = sanitizeUrl(authUrlString);

    localStorage.setItem(this.getKey("last_auth_url"), sanitizedAuthUrl);

    return sanitizedAuthUrl;
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    if (this.preventAutoAuth) return;

    const sanitizedAuthUrl =
      await this.prepareAuthorizationUrl(authorizationUrl);

    const popupFeatures =
      "width=600,height=700,resizable=yes,scrollbars=yes,status=yes";
    try {
      const popup = window.open(
        sanitizedAuthUrl,
        `mcp_auth_${this.serverUrlHash}`,
        popupFeatures,
      );

      // If a callback is provided, invoke it after opening the popup
      if (this.onPopupWindow) {
        this.onPopupWindow(sanitizedAuthUrl, popupFeatures, popup);
      }

      if (!popup || popup.closed || typeof popup.closed === "undefined") {
        console.warn(
          `[${this.storageKeyPrefix}] Popup likely blocked by browser. Manual navigation might be required using the stored URL.`,
        );
      } else {
        popup.focus();
        console.info(
          `[${this.storageKeyPrefix}] Redirecting to authorization URL in popup.`,
        );
      }
    } catch (e) {
      console.error(
        `[${this.storageKeyPrefix}] Error opening popup window:`,
        e,
      );
    }
  }

  getLastAttemptedAuthUrl(): string | null {
    const storedUrl = localStorage.getItem(this.getKey("last_auth_url"));
    return storedUrl ? sanitizeUrl(storedUrl) : null;
  }

  clearStorage(): number {
    const prefixPattern = `${this.storageKeyPrefix}_${this.serverUrlHash}_`;
    const statePattern = `${this.storageKeyPrefix}:state_`;
    const keysToRemove: string[] = [];
    let count = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      if (key.startsWith(prefixPattern)) {
        keysToRemove.push(key);
      } else if (key.startsWith(statePattern)) {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            const state = JSON.parse(item) as Partial<StoredState>;
            if (state.serverUrlHash === this.serverUrlHash) {
              keysToRemove.push(key);
            }
          }
        } catch (e) {
          console.warn(
            `[${this.storageKeyPrefix}] Error parsing state key ${key} during clearStorage:`,
            e,
          );
        }
      }
    }

    const uniqueKeysToRemove = [...new Set(keysToRemove)];
    uniqueKeysToRemove.forEach((key) => {
      localStorage.removeItem(key);
      count++;
    });
    return count;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  getKey(keySuffix: string): string {
    return `${this.storageKeyPrefix}_${this.serverUrlHash}_${keySuffix}`;
  }
}

export async function authenticateMcp(
  serverUrl: string,
  options?: {
    clientName?: string;
    clientUri?: string;
    callbackUrl?: string;
    timeout?: number;
  },
): Promise<AuthResult> {
  try {
    const authProvider = new BrowserOAuthClientProvider(serverUrl, {
      clientName: options?.clientName || "MCP Client",
      clientUri: options?.clientUri || window.location.origin,
      callbackUrl:
        options?.callbackUrl || `${window.location.origin}/oauth/callback`,
    });

    try {
      const metadataUrl = new URL(
        "/.well-known/oauth-protected-resource",
        serverUrl,
      );
      const metadataResponse = await fetch(metadataUrl.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (metadataResponse.status === 404 || !metadataResponse.ok) {
        console.log(
          `[authenticateMcp] Server does not require OAuth (status: ${metadataResponse.status})`,
        );
        return {
          token: null,
          loading: false,
          error: null,
        };
      }

      const contentType = metadataResponse.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.log(
          "[authenticateMcp] Server does not return OAuth metadata, assuming no auth required",
        );
        return {
          token: null,
          loading: false,
          error: null,
        };
      }
    } catch (metadataError) {
      console.log(
        "[authenticateMcp] Error checking OAuth metadata, assuming no auth required:",
        metadataError,
      );
      return {
        token: null,
        loading: false,
        error: null,
      };
    }

    const oauthCompletePromise = new Promise<void>((resolve, reject) => {
      const timeout = options?.timeout || 120000;

      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;

        if (
          event.data?.type === "mcp:oauth:complete" ||
          event.data?.type === "mcp_auth_callback"
        ) {
          window.removeEventListener("message", handleMessage);
          if (event.data.success) {
            resolve();
          } else {
            reject(
              new Error(event.data.error || "OAuth authentication failed"),
            );
          }
        }
      };

      window.addEventListener("message", handleMessage);

      setTimeout(() => {
        window.removeEventListener("message", handleMessage);
        reject(new Error("OAuth authentication timeout"));
      }, timeout);
    });

    await auth(authProvider, { serverUrl });

    await oauthCompletePromise;

    const tokens = await authProvider.tokens();

    return {
      token: tokens?.access_token || null,
      loading: false,
      error: null,
    };
  } catch (error) {
    return {
      token: null,
      loading: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

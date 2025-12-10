// browser-provider.ts
import { OAuthClientInformation, OAuthTokens, OAuthClientMetadata } from '@modelcontextprotocol/sdk/shared/auth.js'
import { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js'
import { auth } from '@modelcontextprotocol/sdk/client/auth.js'
import { sanitizeUrl } from 'strict-url-sanitise'

/**
 * Internal type for storing OAuth state in localStorage during the popup flow.
 */
export interface StoredState {
  serverUrlHash: string
  expiry: number
  providerOptions: {
    serverUrl: string
    storageKeyPrefix?: string
    clientName?: string
    clientUri?: string
    callbackUrl?: string
  }
}

/**
 * Result of MCP OAuth authentication.
 */
export interface AuthResult {
  token: string | null
  loading: boolean
  error: string | null
}

/**
 * Browser-compatible OAuth client provider for MCP using localStorage.
 */
export class BrowserOAuthClientProvider implements OAuthClientProvider {
  readonly serverUrl: string
  readonly storageKeyPrefix: string
  readonly serverUrlHash: string
  readonly clientName: string
  readonly clientUri: string
  readonly callbackUrl: string
  private preventAutoAuth?: boolean
  readonly onPopupWindow: ((url: string, features: string, window: Window | null) => void) | undefined

  constructor(
    serverUrl: string,
    options: {
      storageKeyPrefix?: string
      clientName?: string
      clientUri?: string
      callbackUrl?: string
      preventAutoAuth?: boolean
      onPopupWindow?: (url: string, features: string, window: Window | null) => void
    } = {},
  ) {
    this.serverUrl = serverUrl
    this.storageKeyPrefix = options.storageKeyPrefix || 'mcp:auth'
    this.serverUrlHash = this.hashString(serverUrl)
    this.clientName = options.clientName || 'MCP Browser Client'
    this.clientUri = options.clientUri || (typeof window !== 'undefined' ? window.location.origin : '')
    this.callbackUrl = sanitizeUrl(
      options.callbackUrl ||
        (typeof window !== 'undefined' ? new URL('/oauth/callback', window.location.origin).toString() : '/oauth/callback'),
    )
    this.preventAutoAuth = options.preventAutoAuth
    this.onPopupWindow = options.onPopupWindow
  }

  // --- SDK Interface Methods ---

  get redirectUrl(): string {
    return sanitizeUrl(this.callbackUrl)
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      redirect_uris: [this.redirectUrl],
      token_endpoint_auth_method: 'none', // Public client
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      client_name: this.clientName,
      client_uri: this.clientUri,
      // scope: 'openid profile email mcp', // Example scopes, adjust as needed
    }
  }

  async clientInformation(): Promise<OAuthClientInformation | undefined> {
    const key = this.getKey('client_info')
    const data = localStorage.getItem(key)
    if (!data) return undefined
    try {
      // TODO: Add validation using a schema
      return JSON.parse(data) as OAuthClientInformation
    } catch (e) {
      console.warn(`[${this.storageKeyPrefix}] Failed to parse client information:`, e)
      localStorage.removeItem(key)
      return undefined
    }
  }

  // NOTE: The SDK's auth() function uses this if dynamic registration is needed.
  // Ensure your OAuthClientInformationFull matches the expected structure if DCR is used.
  async saveClientInformation(clientInformation: OAuthClientInformation /* | OAuthClientInformationFull */): Promise<void> {
    const key = this.getKey('client_info')
    // Cast needed if handling OAuthClientInformationFull specifically
    localStorage.setItem(key, JSON.stringify(clientInformation))
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    const key = this.getKey('tokens')
    const data = localStorage.getItem(key)
    if (!data) return undefined
    try {
      // TODO: Add validation
      return JSON.parse(data) as OAuthTokens
    } catch (e) {
      console.warn(`[${this.storageKeyPrefix}] Failed to parse tokens:`, e)
      localStorage.removeItem(key)
      return undefined
    }
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    const key = this.getKey('tokens')
    localStorage.setItem(key, JSON.stringify(tokens))
    // Clean up code verifier and last auth URL after successful token save
    localStorage.removeItem(this.getKey('code_verifier'))
    localStorage.removeItem(this.getKey('last_auth_url'))
  }

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    const key = this.getKey('code_verifier')
    localStorage.setItem(key, codeVerifier)
  }

  async codeVerifier(): Promise<string> {
    const key = this.getKey('code_verifier')
    const verifier = localStorage.getItem(key)
    if (!verifier) {
      throw new Error(
        `[${this.storageKeyPrefix}] Code verifier not found in storage for key ${key}. Auth flow likely corrupted or timed out.`,
      )
    }
    // SDK's auth() retrieves this BEFORE exchanging code. Don't remove it here.
    // It will be removed in saveTokens on success.
    return verifier
  }

  /**
   * Generates and stores the authorization URL with state, without opening a popup.
   * Used when preventAutoAuth is enabled to provide the URL for manual navigation.
   * @param authorizationUrl The fully constructed authorization URL from the SDK.
   * @returns The full authorization URL with state parameter.
   */
  async prepareAuthorizationUrl(authorizationUrl: URL): Promise<string> {
    // Generate a unique state parameter for this authorization request
    const state = crypto.randomUUID()
    const stateKey = `${this.storageKeyPrefix}:state_${state}`

    // Store context needed by the callback handler, associated with the state param
    const stateData: StoredState = {
      serverUrlHash: this.serverUrlHash,
      expiry: Date.now() + 1000 * 60 * 10, // State expires in 10 minutes
      // Store provider options needed to reconstruct on callback
      providerOptions: {
        serverUrl: this.serverUrl,
        storageKeyPrefix: this.storageKeyPrefix,
        clientName: this.clientName,
        clientUri: this.clientUri,
        callbackUrl: this.callbackUrl,
      },
    }
    localStorage.setItem(stateKey, JSON.stringify(stateData))

    // Add the state parameter to the URL
    authorizationUrl.searchParams.set('state', state)
    const authUrlString = authorizationUrl.toString()

    // Sanitize the authorization URL to prevent XSS attacks
    const sanitizedAuthUrl = sanitizeUrl(authUrlString)

    // Persist the exact auth URL in case the popup fails and manual navigation is needed
    localStorage.setItem(this.getKey('last_auth_url'), sanitizedAuthUrl)

    return sanitizedAuthUrl
  }

  /**
   * Redirects the user agent to the authorization URL, storing necessary state.
   * This now adheres to the SDK's void return type expectation for the interface.
   * @param authorizationUrl The fully constructed authorization URL from the SDK.
   */
  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    // Ideally we should catch things before we get here, but if we don't, let's not show everyone we are dum
    if (this.preventAutoAuth) return

    // Prepare the authorization URL with state
    const sanitizedAuthUrl = await this.prepareAuthorizationUrl(authorizationUrl)

    // Attempt to open the popup
    const popupFeatures = 'width=600,height=700,resizable=yes,scrollbars=yes,status=yes' // Make configurable if needed
    try {
      const popup = window.open(sanitizedAuthUrl, `mcp_auth_${this.serverUrlHash}`, popupFeatures)

      // If a callback is provided, invoke it after opening the popup
      if (this.onPopupWindow) {
        this.onPopupWindow(sanitizedAuthUrl, popupFeatures, popup)
      }

      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        console.warn(
          `[${this.storageKeyPrefix}] Popup likely blocked by browser. Manual navigation might be required using the stored URL.`,
        )
        // Cannot signal failure back via SDK auth() directly.
        // useMcp will need to rely on timeout or manual trigger if stuck.
      } else {
        popup.focus()
        console.info(`[${this.storageKeyPrefix}] Redirecting to authorization URL in popup.`)
      }
    } catch (e) {
      console.error(`[${this.storageKeyPrefix}] Error opening popup window:`, e)
      // Cannot signal failure back via SDK auth() directly.
    }
    // Regardless of popup success, the interface expects this method to initiate the redirect.
    // If the popup failed, the user journey stops here until manual action or timeout.
  }

  // --- Helper Methods ---

  /**
   * Retrieves the last URL passed to `redirectToAuthorization`. Useful for manual fallback.
   */
  getLastAttemptedAuthUrl(): string | null {
    const storedUrl = localStorage.getItem(this.getKey('last_auth_url'))
    return storedUrl ? sanitizeUrl(storedUrl) : null
  }

  clearStorage(): number {
    const prefixPattern = `${this.storageKeyPrefix}_${this.serverUrlHash}_`
    const statePattern = `${this.storageKeyPrefix}:state_`
    const keysToRemove: string[] = []
    let count = 0

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue

      if (key.startsWith(prefixPattern)) {
        keysToRemove.push(key)
      } else if (key.startsWith(statePattern)) {
        try {
          const item = localStorage.getItem(key)
          if (item) {
            // Check if state belongs to this provider instance based on serverUrlHash
            // We need to parse cautiously as the structure isn't guaranteed.
            const state = JSON.parse(item) as Partial<StoredState>
            if (state.serverUrlHash === this.serverUrlHash) {
              keysToRemove.push(key)
            }
          }
        } catch (e) {
          console.warn(`[${this.storageKeyPrefix}] Error parsing state key ${key} during clearStorage:`, e)
          // Optionally remove malformed keys
          // keysToRemove.push(key);
        }
      }
    }

    const uniqueKeysToRemove = [...new Set(keysToRemove)]
    uniqueKeysToRemove.forEach((key) => {
      localStorage.removeItem(key)
      count++
    })
    return count
  }

  private hashString(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(16)
  }

  getKey(keySuffix: string): string {
    return `${this.storageKeyPrefix}_${this.serverUrlHash}_${keySuffix}`
  }
}

/**
 * Authenticate with an MCP server using OAuth.
 * Returns token, loading state, and error if any.
 * Waits for the OAuth popup to complete before returning.
 *
 * @param serverUrl The MCP server URL to authenticate with
 * @param options Optional configuration for OAuth client
 * @returns Promise resolving to AuthResult with token, loading, and error states
 *
 * @example
 * ```typescript
 * const { token, loading, error } = await authenticateMcp(
 *   connection.connection_url,
 *   {
 *     clientName: 'MCP Mesh',
 *     clientUri: window.location.origin,
 *     callbackUrl: `${window.location.origin}/oauth/callback`
 *   }
 * );
 *
 * if (token) {
 *   await saveConnectionToken(connectionId, token);
 * }
 * ```
 */
export async function authenticateMcp(
  serverUrl: string,
  options?: {
    clientName?: string
    clientUri?: string
    callbackUrl?: string
    timeout?: number
  }
): Promise<AuthResult> {
  try {
    // 1. Create OAuth provider
    const authProvider = new BrowserOAuthClientProvider(serverUrl, {
      clientName: options?.clientName || 'MCP Client',
      clientUri: options?.clientUri || window.location.origin,
      callbackUrl: options?.callbackUrl || `${window.location.origin}/oauth/callback`,
    })

    // 2. Check for existing token in cache
    const existingTokens = await authProvider.tokens()
    if (existingTokens?.access_token) {
      return {
        token: existingTokens.access_token,
        loading: false,
        error: null,
      }
    }

    // 3. Check if server has OAuth (attempt to discover metadata)
    try {
      const metadataUrl = new URL('/.well-known/oauth-protected-resource', serverUrl)
      const metadataResponse = await fetch(metadataUrl.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      })
      
      // If returns 404 or error, server doesn't have OAuth
      if (metadataResponse.status === 404 || !metadataResponse.ok) {
        console.log(`[authenticateMcp] Server does not require OAuth (status: ${metadataResponse.status})`)
        return {
          token: null,
          loading: false,
          error: null,
        }
      }

      // Check if response is valid JSON (indicates OAuth server)
      const contentType = metadataResponse.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        console.log('[authenticateMcp] Server does not return OAuth metadata, assuming no auth required')
        return {
          token: null,
          loading: false,
          error: null,
        }
      }
    } catch (metadataError) {
      // If error checking metadata, assume no OAuth required
      console.log('[authenticateMcp] Error checking OAuth metadata, assuming no auth required:', metadataError)
      return {
        token: null,
        loading: false,
        error: null,
      }
    }

    // 4. If reached here, server has OAuth - create Promise that waits for completion
    const oauthCompletePromise = new Promise<void>((resolve, reject) => {
      const timeout = options?.timeout || 120000 // 2 minutes default

      // Listen for popup message when OAuth completes
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return

        if (event.data?.type === 'mcp:oauth:complete' || event.data?.type === 'mcp_auth_callback') {
          window.removeEventListener('message', handleMessage)
          if (event.data.success) {
            resolve()
          } else {
            reject(new Error(event.data.error || 'OAuth authentication failed'))
          }
        }
      }

      window.addEventListener('message', handleMessage)

      // Timeout if takes too long
      setTimeout(() => {
        window.removeEventListener('message', handleMessage)
        reject(new Error('OAuth authentication timeout'))
      }, timeout)
    })

    // 5. Execute OAuth flow (opens popup)
    await auth(authProvider, { serverUrl })

    // 6. Wait for OAuth to complete
    await oauthCompletePromise

    // 7. Retrieve token after authentication
    const tokens = await authProvider.tokens()

    return {
      token: tokens?.access_token || null,
      loading: false,
      error: null,
    }
  } catch (error) {
    return {
      token: null,
      loading: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
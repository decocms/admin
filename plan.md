# Plan: Support Inline App Schemas in OAuth Flow for Localhost Development

## Context

Currently, the OAuth authorization route (`/apps/auth`) expects a `client_id` parameter that is an app name (e.g., `@scope/app-name`). It fetches the app schema from the registry database and uses that to:
1. Display app information (name, icon, description)
2. Fetch the app's OAuth configuration schema
3. Create integrations and API keys
4. Generate OAuth codes with JWT tokens

This doesn't work well for localhost development because:
- Apps need to be published to the registry before testing OAuth flows
- Developers can't iterate quickly on OAuth schemas
- No way to test unpublished apps

## Goal

Support passing an **inline app schema** in the URI as a JSON blob (likely base64-encoded) instead of just a `client_id`. This allows:
- Testing OAuth flows with unpublished apps during localhost development
- Iterating on app OAuth schemas without publishing
- Generating JWTs for apps that don't exist in the registry yet

## Implementation Plan

### 1. Update the OAuth Search Params Schema (`apps/web/src/components/apps/layout.tsx`)

**Current Schema:**
```typescript
export const OAuthSearchParamsSchema = z.object({
  client_id: z.string(),
  redirect_uri: z.string(),
  state: z.string().optional(),
  workspace_hint: z.string().optional(),
});
```

**New Schema:**
```typescript
// Inline app schema for localhost development
// Only includes technical OAuth details, not presentation metadata
const InlineAppSchema = z.object({
  connection: MCPConnectionSchema, // Import from packages/sdk
  scopes: z.array(z.string()).optional(), // OAuth scopes
  stateSchema: z.record(z.unknown()).optional(), // JSON Schema for app configuration
});

export const OAuthSearchParamsSchema = z.object({
  // Union type: either client_id OR app_data
  client_id: z.string().optional(),
  app_data: z.string().optional(), // Base64-encoded JSON of InlineAppSchema
  
  redirect_uri: z.string(),
  state: z.string().optional(),
  workspace_hint: z.string().optional(),
}).refine(
  (data) => {
    // Exactly one of client_id or app_data must be provided
    return (data.client_id && !data.app_data) || (!data.client_id && data.app_data);
  },
  {
    message: "Either client_id or app_data must be provided, but not both",
  }
);

export type OAuthSearchParams = z.infer<typeof OAuthSearchParamsSchema>;
```

**Changes:**
- Make `client_id` optional
- Add `app_data` as an optional string parameter (base64-encoded JSON)
- Add refinement to ensure exactly one is provided
- The `app_data` will be decoded and parsed against `InlineAppSchema`

### 2. Update Auth Layout to Decode Inline Apps (`apps/web/src/components/apps/layout.tsx`)

**Add helper function:**
```typescript
function decodeAppData(appData: string): z.infer<typeof InlineAppSchema> {
  try {
    const decoded = atob(appData);
    const parsed = JSON.parse(decoded);
    return InlineAppSchema.parse(parsed);
  } catch (error) {
    throw new Error(`Invalid app_data: ${error.message}`);
  }
}
```

**Update AppsAuthLayout:**
```typescript
export function AppsAuthLayout({ children }: AppsAuthLayoutProps) {
  const [searchParams] = useSearchParams();
  const params = Object.fromEntries(searchParams);
  
  const result = OAuthSearchParamsSchema.safeParse(params);

  if (!result.success) {
    return (
      <DecoQueryClientProvider>
        <SplitScreenLayout>
          <ErrorPanel />
        </SplitScreenLayout>
      </DecoQueryClientProvider>
    );
  }

  // Decode inline app if provided
  const processedParams = {
    ...result.data,
    inlineApp: result.data.app_data 
      ? decodeAppData(result.data.app_data) 
      : undefined,
  };

  return (
    <DecoQueryClientProvider>
      <SplitScreenLayout>{children(processedParams)}</SplitScreenLayout>
    </DecoQueryClientProvider>
  );
}
```

### 3. Update Auth Component to Handle Both Registry and Inline Apps (`apps/web/src/components/apps/auth.tsx`)

**Create a unified app type:**
```typescript
type AppSource = 
  | { type: 'registry'; clientId: string }
  | { type: 'inline'; app: InlineApp };

type UnifiedApp = {
  // Display info
  name: string;
  friendlyName?: string;
  description?: string;
  icon?: string;
  verified?: boolean;
  
  // Technical OAuth details
  connection: MCPConnection;
  scopes?: string[];
  stateSchema?: Record<string, unknown>;
  
  // Registry-only fields
  id?: string;
  workspace?: string;
};
```

**Update AppsOAuth component:**
```typescript
function AppsOAuth({
  client_id,
  inlineApp,
  redirect_uri,
  state,
  workspace_hint,
}: OAuthSearchParams & { inlineApp?: InlineApp }) {
  // Determine app source
  const appSource: AppSource = inlineApp 
    ? { type: 'inline', app: inlineApp }
    : { type: 'registry', clientId: client_id! };

  // Conditionally fetch from registry only if not inline
  const { data: registryApp } = useRegistryApp(
    { app: appSource.type === 'registry' ? appSource.clientId : '' },
    { enabled: appSource.type === 'registry' }
  );

  const { data: orgs } = useOrganizations();
  const [org, setOrg] = useState<Team | null>(() =>
    preSelectTeam(orgs, workspace_hint),
  );

  // Convert to unified app
  const app: UnifiedApp | null = useMemo(() => {
    if (appSource.type === 'inline') {
      return {
        // Generic display info for localhost apps
        name: 'Localhost App',
        friendlyName: 'Development App',
        description: 'App in development',
        verified: false,
        // Technical OAuth details from inline schema
        connection: appSource.app.connection,
        scopes: appSource.app.scopes,
        stateSchema: appSource.app.stateSchema,
      };
    }
    
    if (!registryApp) return null;
    
    return {
      name: registryApp.name,
      friendlyName: registryApp.friendlyName,
      description: registryApp.description,
      icon: registryApp.icon,
      verified: registryApp.verified,
      connection: registryApp.connection,
      scopes: registryApp.scopes,
      stateSchema: registryApp.stateSchema,
      id: registryApp.id,
      workspace: registryApp.workspace,
    };
  }, [appSource, registryApp]);

  if (!orgs || orgs.length === 0 || !app) {
    return <NoProjectFound />;
  }

  // Rest of the component remains similar, but passes app and appSource down
  // ...
}
```

**Update SelectProjectAppInstance component:**
- Accept `appSource` prop to know if it's inline or registry
- Pass this information to OAuth code creation

### 4. Create New API Endpoint for Inline App OAuth Codes (`packages/sdk/src/mcp/oauth/api.ts`)

**Add new tool:**
```typescript
export const oauthCodeCreateForInlineApp = createTool({
  name: "OAUTH_CODE_CREATE_INLINE_APP",
  description: "Create an OAuth code for an inline app (localhost development)",
  inputSchema: z.object({
    integrationId: z.string().describe("The ID of the integration"),
    inlineApp: InlineAppSchema.describe("The inline app configuration"),
  }),
  outputSchema: z.object({
    code: z.string().describe("The OAuth code"),
  }),
  handler: async ({ integrationId, inlineApp }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);
    
    const mcpClient = MCPClient.forContext(c);
    const integration = await mcpClient.INTEGRATIONS_GET({
      id: integrationId,
    });
    
    // For inline apps, we need to create a JWT from scratch
    // because the integration doesn't have a pre-existing token from registry
    const issuer = await c.jwtIssuer();
    
    // Create claims for the inline app
    const claims = {
      sub: c.workspace.value,
      workspace: c.workspace.value,
      apiKeyId: integration.id,
      user: JSON.stringify(c.user),
      appName: 'localhost-app', // Generic name for development apps
      // Add state if the integration has it
      state: integration.state,
    };
    
    const token = await issuer.issue(claims);
    
    // Store the JWT with the integration if it doesn't have one
    // This is important for subsequent API calls
    if (integration.connection.type === "HTTP" && !integration.connection.token) {
      await mcpClient.INTEGRATIONS_UPDATE({
        id: integrationId,
        connection: {
          ...integration.connection,
          token,
        },
      });
    }
    
    const code = crypto.randomUUID();

    const { error } = await c.db.from("deco_chat_oauth_codes").insert({
      code,
      claims: {
        ...claims,
        // Include inline app info for the receiving app
        inlineApp: true,
      },
      workspace: c.workspace.value,
    });
    
    if (error) {
      throw new Error(error.message);
    }
    
    return { code };
  },
});
```

### 5. Update Frontend Hook to Support Inline Apps (`packages/sdk/src/hooks/mcp.ts`)

**Update the hook:**
```typescript
export const useCreateOAuthCodeForIntegration = () => {
  const mutation = useMutation({
    mutationFn: async (params: {
      integrationId: string;
      workspace: ProjectLocator;
      redirectUri: string;
      state?: string;
      inlineApp?: InlineApp; // NEW: For inline apps
    }) => {
      const { integrationId, workspace, redirectUri, state, inlineApp } = params;

      let code: string;
      
      if (inlineApp) {
        // Use the new inline app endpoint
        const result = await MCPClient.forLocator(workspace)
          .OAUTH_CODE_CREATE_INLINE_APP({
            integrationId,
            inlineApp,
          });
        code = result.code;
      } else {
        // Use the regular endpoint for registry apps
        const result = await MCPClient.forLocator(workspace)
          .OAUTH_CODE_CREATE({
            integrationId,
          });
        code = result.code;
      }

      const url = new URL(redirectUri);
      url.searchParams.set("code", code);
      state && url.searchParams.set("state", state);

      return {
        redirectTo: url.toString(),
      };
    },
  });

  return mutation;
};
```

### 6. Update Integration Creation for Inline Apps (`packages/sdk/src/mcp/integrations/api.ts`)

**Update createIntegration handler:**
```typescript
export const createIntegration = createIntegrationManagementTool({
  name: "INTEGRATIONS_CREATE",
  // ... existing schema with new optional field
  inputSchema: IntegrationSchema.partial()
    .omit({ appName: true })
    .extend({
      clientIdFromApp: z.string().optional(),
      inlineApp: InlineAppSchema.optional(), // NEW
    }),
  handler: async (_integration, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const { appId, clientIdFromApp, inlineApp, ...integration } = _integration;
    
    // Fetch app from registry OR use inline
    let fetchedApp: RegistryApp | undefined;
    let appForIntegration: { id?: string; name: string } | undefined;
    
    if (inlineApp) {
      // For inline apps, we don't have a registry ID
      appForIntegration = {
        name: 'localhost-app', // Generic name for development
        // No ID since it's not in registry
      };
    } else if (clientIdFromApp) {
      fetchedApp = await getRegistryApp.handler({ name: clientIdFromApp });
      appForIntegration = {
        id: fetchedApp.id,
        name: fetchedApp.name,
      };
    }

    const projectId = await getProjectIdFromContext(c);

    const payload = {
      ...NEW_INTEGRATION_TEMPLATE,
      ...integration,
      workspace: c.workspace.value,
      id: integration.id ? parseId(integration.id).uuid : undefined,
      app_id: appId ?? appForIntegration?.id, // May be undefined for inline
      project_id: projectId,
    };

    // Rest of the handler remains the same
    // ...
  },
});
```

### 7. Update Installation Flow for Inline Apps (`apps/web/src/hooks/use-integration-install.tsx`)

**Update the installation hook:**
- Pass inline app data through the installation flow
- When creating an integration for an inline app, pass the `inlineApp` parameter
- Ensure the JWT is generated properly for inline apps

### 8. Type Definitions and Exports

**Create shared type definitions in `packages/sdk/src/mcp/registry/types.ts`:**
```typescript
// Minimal schema for localhost app development
// Only includes technical OAuth details needed for the flow
export const InlineAppSchema = z.object({
  connection: MCPConnectionSchema,
  scopes: z.array(z.string()).optional(),
  stateSchema: z.record(z.unknown()).optional(),
});

export type InlineApp = z.infer<typeof InlineAppSchema>;

export type AppSource = 
  | { type: 'registry'; clientId: string }
  | { type: 'inline'; app: InlineApp };
```

**Export from main SDK:**
```typescript
// packages/sdk/src/index.ts
export type { InlineApp, AppSource } from './mcp/registry/types.ts';
export { InlineAppSchema } from './mcp/registry/types.ts';
```

## Runtime Package Changes

### Key Finding: OAuth Redirect URL Construction

In `packages/runtime/src/index.ts` (lines 260-271), when an unauthenticated request triggers `ensureAuthenticated()`, it constructs a redirect to the OAuth authorization page:

```typescript
const authUri = new URL("/apps/oauth", apiUrl);
authUri.searchParams.set("client_id", env.DECO_APP_NAME);
authUri.searchParams.set(
  "redirect_uri",
  new URL(AUTH_CALLBACK_ENDPOINT, origin ?? env.DECO_APP_ENTRYPOINT).href,
);
workspaceHint && authUri.searchParams.set("workspace_hint", workspaceHint);
throw new UnauthorizedError("Unauthorized", authUri);
```

### Required Changes for Localhost Support

**1. Detect Localhost Mode**
The runtime already has an `IS_LOCAL` flag (line 189-192):
```typescript
env["IS_LOCAL"] =
  (url?.startsWith("http://localhost") ||
    url?.startsWith("http://127.0.0.1")) ??
  false;
```

**2. Build Inline App Data**
When in localhost mode, instead of passing `client_id`, we need to:
- Get the MCP connection info (the app's own HTTP endpoint)
- Get the OAuth config (scopes and stateSchema from `userFns.oauth`)
- Base64-encode this as inline app data

**3. Modify `ensureAuthenticated` in Localhost Mode**

The `ensureAuthenticated` function needs to check if running locally and:
- Build the inline app object with `connection`, `scopes`, and `stateSchema`
- Base64-encode it
- Pass as `app_data` instead of `client_id`

### Implementation Details

The challenge is that `ensureAuthenticated` is constructed in `withBindings`, but it needs access to:
1. The server's OAuth configuration (from `userFns.oauth`)
2. The connection URL (from `origin` or `env.DECO_APP_ENTRYPOINT`)
3. The `IS_LOCAL` flag

**Solution**: Pass these through the context or make them available when constructing `ensureAuthenticated`.

### Code Example: Runtime Changes

**In `withRuntime` function:**
```typescript
export const withRuntime = <TEnv, TSchema extends z.ZodTypeAny = never>(
  userFns: UserDefaultExport<TEnv, TSchema>,
): ExportedHandler<TEnv & DefaultEnv<TSchema>> & {
  Workflow: ReturnType<typeof Workflow>;
} => {
  const server = createMCPServer<TEnv, TSchema>(userFns);
  
  // NEW: Capture OAuth config to pass to withBindings
  const oauthConfig = userFns.oauth;
  
  const fetcher = async (
    req: Request,
    env: TEnv & DefaultEnv<TSchema>,
    ctx: ExecutionContext,
  ) => {
    // ... existing routes ...
  };
  
  return {
    Workflow: Workflow(server, userFns.workflows),
    fetch: async (
      req: Request,
      env: TEnv & DefaultEnv<TSchema>,
      ctx: ExecutionContext,
    ) => {
      // ... existing code ...
      try {
        const bindings = withBindings({
          env,
          server,
          oauthConfig, // NEW: Pass OAuth config
          branch: /* ... */,
          tokenOrContext: await getReqToken(req, env),
          origin: /* ... */,
          url: req.url,
        });
        // ... rest of code
      }
    },
  };
};
```

**In `withBindings` function:**
```typescript
export const withBindings = <TEnv>({
  env: _env,
  server,
  tokenOrContext,
  origin,
  url,
  branch,
  oauthConfig, // NEW: Receive OAuth config
}: {
  env: TEnv;
  server: MCPServer<TEnv, any>;
  tokenOrContext?: string | RequestContext;
  origin?: string | null;
  url?: string;
  branch?: string | null;
  oauthConfig?: { state?: z.ZodTypeAny; scopes?: string[] }; // NEW
}): TEnv => {
  // ... existing code ...
  
  // Determine if running locally
  const isLocal = 
    url?.startsWith("http://localhost") ||
    url?.startsWith("http://127.0.0.1");
  
  // ... existing tokenOrContext handling ...
  
  } else {
    context = {
      state: undefined,
      token: env.DECO_API_TOKEN,
      workspace: env.DECO_WORKSPACE,
      branch,
      ensureAuthenticated: (options?: { workspaceHint?: string }) => {
        const workspaceHint = options?.workspaceHint ?? env.DECO_WORKSPACE;
        const authUri = new URL("/apps/oauth", apiUrl);
        
        // NEW: Check if localhost and build inline app data
        if (isLocal && oauthConfig) {
          // Build inline app object
          const mcpEndpoint = new URL("/mcp", origin ?? env.DECO_APP_ENTRYPOINT).href;
          const inlineApp = {
            connection: {
              type: "HTTP" as const,
              url: mcpEndpoint,
            },
            scopes: oauthConfig.scopes,
            stateSchema: oauthConfig.state 
              ? zodToJsonSchema(oauthConfig.state)
              : { type: "object", properties: {} },
          };
          
          // Base64 encode the inline app data
          const appData = btoa(JSON.stringify(inlineApp));
          authUri.searchParams.set("app_data", appData);
        } else {
          // Regular flow: use client_id
          authUri.searchParams.set("client_id", env.DECO_APP_NAME);
        }
        
        authUri.searchParams.set(
          "redirect_uri",
          new URL(AUTH_CALLBACK_ENDPOINT, origin ?? env.DECO_APP_ENTRYPOINT).href,
        );
        workspaceHint &&
          authUri.searchParams.set("workspace_hint", workspaceHint);
        throw new UnauthorizedError("Unauthorized", authUri);
      },
    };
  }
  
  // ... rest of function
};
```

### Key Points:

1. **Detection**: Uses the URL to detect localhost (already happens for `IS_LOCAL`)
2. **MCP Connection**: Builds HTTP connection pointing to the app's own `/mcp` endpoint
3. **OAuth Config**: Gets `scopes` and `stateSchema` from `userFns.oauth`
4. **Encoding**: Base64-encodes the inline app JSON
5. **Parameter**: Uses `app_data` instead of `client_id` for localhost

This way, when a localhost app redirects to the OAuth flow, it sends its own configuration inline, avoiding the need to be published to the registry.

## File Changes Summary

### Files to Create:
1. None (all changes are modifications)

### Files to Modify:

#### Backend Runtime (Localhost Detection & Redirect)

8. **`packages/runtime/src/index.ts`**
   - Modify `withRuntime` to capture OAuth config from `userFns`
   - Pass OAuth config and origin to `withBindings`
   - Update `ensureAuthenticated` to detect localhost and build inline app data
   - When `IS_LOCAL`, base64-encode inline app and use `app_data` param

9. **`packages/runtime/src/connection.ts`**
   - Export `MCPConnectionSchema` for validation (if not already exported)

10. **`packages/runtime/src/index.ts`** (imports)
   - Import `zodToJsonSchema` from `zod-to-json-schema` (already used in mastra.ts)
   - This is needed to convert the Zod schema to JSON schema for inline apps

#### Backend API (OAuth Code Generation)

1. **`apps/web/src/components/apps/layout.tsx`**
   - Update `OAuthSearchParamsSchema` to support both `client_id` and `app_data`
   - Add `decodeAppData` helper function
   - Update `AppsAuthLayout` to decode and pass inline apps

2. **`apps/web/src/components/apps/auth.tsx`**
   - Create `AppSource` and `UnifiedApp` types
   - Update `AppsOAuth` to handle both registry and inline apps
   - Update `SelectProjectAppInstance` to pass app source information
   - Update OAuth code creation call to include inline app data

3. **`packages/sdk/src/mcp/registry/api.ts`**
   - Add/export `InlineAppSchema`
   - Add/export `InlineApp` type

4. **`packages/sdk/src/mcp/oauth/api.ts`**
   - Add `oauthCodeCreateForInlineApp` tool
   - Generate JWT tokens for inline apps during OAuth flow

5. **`packages/sdk/src/mcp/integrations/api.ts`**
   - Update `createIntegration` to accept `inlineApp` parameter
   - Handle integration creation without registry app ID

6. **`packages/sdk/src/hooks/mcp.ts`**
   - Update `useCreateOAuthCodeForIntegration` to support inline apps
   - Conditionally call different endpoints based on app source

7. **`packages/sdk/src/index.ts`**
   - Export new types and schemas

8. **`packages/runtime/src/index.ts`** (NEW - Runtime Changes)
   - Modify `withBindings` to pass OAuth config and IS_LOCAL flag to `ensureAuthenticated`
   - Update `ensureAuthenticated` function to build inline app data in localhost mode
   - Base64-encode inline app JSON and pass as `app_data` instead of `client_id`

9. **`packages/runtime/src/mastra.ts`** (NEW - Runtime Changes)
   - The `DECO_CHAT_OAUTH_START` tool already returns the right data, no changes needed
   - This tool is what the API calls to get schema from published apps

## Testing Strategy

### Manual Testing:

1. **Registry App Flow (Existing):**
   - Visit `/apps/auth?client_id=@scope/app-name&redirect_uri=...`
   - Verify existing flow still works

2. **Inline App Flow (New):**
   - Create inline app JSON with test connection
   - Base64 encode it
   - Visit `/apps/auth?app_data=<base64>&redirect_uri=...`
   - Verify:
     - App info displays correctly
     - Can select organization
     - Can create/select integration
     - OAuth code is generated
     - JWT token works with the inline app
     - Redirect happens with code

3. **Error Cases:**
   - Both `client_id` and `app_data` provided → should show error
   - Neither `client_id` nor `app_data` provided → should show error
   - Invalid base64 in `app_data` → should show error
   - Invalid JSON in decoded `app_data` → should show error

### Integration Tests:

1. Test OAuth code creation for inline apps
2. Test JWT token generation and validation
3. Test integration creation without registry app ID

## Security Considerations

1. **Validation:** Always validate the inline app schema strictly
2. **Localhost Only:** Consider adding a check to only allow inline apps in development/localhost environments
3. **JWT Claims:** Ensure inline app JWTs have appropriate claims and expiration
4. **Rate Limiting:** Consider rate limiting OAuth code creation for inline apps

## Migration & Rollout

- **Backwards Compatible:** All changes are additive; existing flows continue to work
- **Feature Flag:** Consider adding a feature flag for inline app support
- **Monitoring:** Add analytics/logging for inline app OAuth flows

## Future Enhancements

1. Add validation webhook for inline app schemas
2. Cache inline app data to avoid re-encoding on each request
3. Add developer-friendly UI for generating inline app URLs
4. Support transitioning inline apps to registry apps
5. Add developer mode indicator in UI when using inline apps

## Simplified Inline App Schema

The inline app schema has been intentionally kept minimal to only include **technical OAuth details**:

```typescript
{
  connection: MCPConnection,  // Where to connect to the MCP server
  scopes?: string[],          // OAuth scopes if needed
  stateSchema?: object        // JSON Schema for app configuration
}
```

**Display metadata is NOT included** (no name, icon, description). The UI will show:
- Name: "Localhost App"
- Friendly Name: "Development App"
- Description: "App in development"
- Icon: Generic development icon
- Verified: false

**Example inline app JSON:**
```json
{
  "connection": {
    "type": "HTTP",
    "url": "http://localhost:8080/mcp"
  },
  "scopes": ["read", "write"],
  "stateSchema": {
    "type": "object",
    "properties": {
      "apiKey": { "type": "string" },
      "environment": { "type": "string", "enum": ["dev", "prod"] }
    },
    "required": ["apiKey"]
  }
}
```

This would be base64-encoded and passed as: `/apps/auth?app_data=<base64>&redirect_uri=...`

## Summary: Complete Flow for Localhost Apps

### 1. Developer Experience
```typescript
// In their MCP app main.ts
export default withRuntime({
  oauth: {
    state: z.object({
      apiKey: z.string(),
      environment: z.enum(['dev', 'prod']),
    }),
    scopes: ['read', 'write'],
  },
  tools: [/* ... */],
});
```

### 2. Runtime Detects Localhost (Automatic)
When the app calls `ctx.ensureAuthenticated()` from `http://localhost:8080`:
- Runtime detects it's running locally
- Builds inline app data with connection, scopes, and stateSchema
- Base64-encodes it
- Redirects to: `https://api.decocms.com/apps/oauth?app_data=<base64>&redirect_uri=http://localhost:8080/oauth/callback`

### 3. Web UI Handles Inline App
- Layout decodes base64 `app_data` parameter
- Validates against `InlineAppSchema`
- Displays as "Localhost App" with generic icon
- User selects organization/project
- Creates/selects integration

### 4. Backend Generates JWT
- Creates OAuth code linked to integration
- Generates JWT with claims:
  - `workspace`, `apiKeyId`, `user`, `state`
  - `appName: 'localhost-app'`
- Stores in `deco_chat_oauth_codes` table

### 5. OAuth Callback Completes
- App exchanges code for JWT token
- Token is stored in cookies
- App can now make authenticated requests with the JWT

### Key Benefits
✅ No need to publish to registry for testing  
✅ Iterate on OAuth schemas quickly  
✅ Test authentication flow end-to-end locally  
✅ Seamless transition to production (just publish to registry)  
✅ Backwards compatible with existing apps  

## Questions to Resolve

1. Should inline apps be restricted to localhost/development environments only?
   - **Recommendation**: Yes, add a check in the API to only accept `app_data` from localhost origins
2. Should we add a warning/indicator in the UI when using inline apps?
   - **Recommendation**: Yes, show a "Development Mode" badge
3. Do we need to store inline app information persistently, or is it ephemeral?
   - **Answer**: Ephemeral - only exists in the URL and OAuth flow, not stored
4. Should the OAuth code have a shorter expiration for inline apps?
   - **Recommendation**: Use same expiration, but consider logging for monitoring
5. Do inline apps need state validation like registry apps?
   - **Recommendation**: No, skip the state validation call since there's no remote app to call


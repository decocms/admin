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
const InlineAppSchema = z.object({
  name: z.string(),
  friendlyName: z.string().optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  connection: MCPConnectionSchema, // Import from packages/sdk
  // Add other optional fields that mirror RegistryApp as needed
  verified: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
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
  name: string;
  friendlyName?: string;
  description?: string;
  icon?: string;
  verified?: boolean;
  connection: MCPConnection;
  // For inline apps, we won't have these
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
        name: appSource.app.name,
        friendlyName: appSource.app.friendlyName,
        description: appSource.app.description,
        icon: appSource.app.icon,
        verified: appSource.app.verified ?? false,
        connection: appSource.app.connection,
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
      appName: inlineApp.name,
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
        name: inlineApp.name,
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
export const InlineAppSchema = z.object({
  name: z.string(),
  friendlyName: z.string().optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  connection: MCPConnectionSchema,
  verified: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
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

## File Changes Summary

### Files to Create:
1. None (all changes are modifications)

### Files to Modify:

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

## Questions to Resolve

1. Should inline apps be restricted to localhost/development environments only?
2. Should we add a warning/indicator in the UI when using inline apps?
3. Do we need to store inline app information persistently, or is it ephemeral?
4. Should the OAuth code have a shorter expiration for inline apps?
5. Do inline apps need state validation like registry apps?


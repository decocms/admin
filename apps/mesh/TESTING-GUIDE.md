# MCP Mesh - Testing Guide

## Database Migrations

The server now automatically runs Kysely migrations on startup! You should see:

```
🔄 Running database migrations...
✅ Migration "001_initial_schema" executed successfully
🎉 All migrations completed successfully

✅ MCP Mesh starting...
```

## Testing the Unified Authentication System

### Test 1: OAuth Flow with Scope Selection ✅

**Step 1: Start Fresh**
1. Delete the database: `rm apps/mesh/data/mesh.db`
2. Restart server: `bun run src/index.ts`
3. Migrations will create all tables automatically

**Step 2: Initiate OAuth from MCP Client**
Your MCP client will redirect to:
```
http://localhost:3000/sign-in?response_type=code&client_id=...&state=...
```

**Step 3: Create Account or Sign In**
- Fill in the form (email, password, name if signing up)
- Click "Sign In" or "Create Account"

**Browser Console Should Show:**
```javascript
[Sign-In] OAuth flow detected, redirecting to consent page: /authorize?...
```

**Step 4: See Consent Page**
You should be redirected to `/authorize` with:
- ✅ All management tools listed with checkboxes
- ✅ Grouped by category (Projects, Connections)
- ✅ All tools pre-selected by default
- ✅ Dangerous operations highlighted in yellow

**Step 5: Authorize**
Click "Authorize" button

**Browser Console Should Show:**
```javascript
[Authorize] Original scopes: openid profile email offline_access
[Authorize] Updated scopes: openid profile email offline_access mcp:*
[Authorize] Full URL: /api/auth/authorize?...&scope=openid+profile+email+offline_access+mcp%3A*
```

**Step 6: Get Redirected to Client**
Better Auth will redirect (server-side) to:
```
http://localhost:6274/oauth/callback?code=...&state=...
```

**Step 7: Client Exchanges Code for Token**
Your client will exchange the code for an access token.

**Step 8: Client Calls /mcp Endpoint**
When your client makes a request to `/mcp`, check **server console**:

```
[Auth] ✅ OAuth session authenticated:
  User ID: fhdnCtlMRtLQTyRjGe1ITi5katDFjqVr
  Raw scopes: openid profile email offline_access mcp:*
  Parsed permissions: {
  "mcp": [
    "*"
  ]
}
```

**✅ Success!** The `mcp:*` scope grants access to all management tools.

### Test 2: API Key Flow ✅

**Step 1: Sign In Normally**
1. Go to: `http://localhost:3000/sign-in`
2. Sign in (without OAuth parameters)

**Step 2: Create API Key**
1. Go to: `http://localhost:3000/api-keys`
2. Fill in key name: "Test Key"
3. Select expiration: 90 days
4. Click "Create API Key"
5. **Copy the key immediately!** Format: `mcp_abc123...`

**Step 3: Use API Key**
Use the key in your MCP client:
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer mcp_abc123..." \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

**Server Console Should Show:**
```
[Auth] API key authenticated: { keyName: 'Test Key', permissions: { mcp: ['*'] } }
```

**✅ Success!** The API key grants access to all tools.

## Scope Format

### OAuth Scopes → Permissions

**Input scopes:**
```
openid profile email offline_access mcp:*
```

**Parsed permissions:**
```json
{
  "mcp": ["*"]
}
```

This grants access to ALL management tools:
- PROJECT_CREATE, PROJECT_LIST, PROJECT_GET, PROJECT_UPDATE, PROJECT_DELETE
- CONNECTION_CREATE, CONNECTION_LIST, CONNECTION_GET, CONNECTION_DELETE, CONNECTION_TEST

### Wildcard Support

The scope parser now supports any connection prefix:
- `mcp:*` → `{ "mcp": ["*"] }`
- `conn_123:*` → `{ "conn_123": ["*"] }`
- `mcp:PROJECT_CREATE` → `{ "mcp": ["PROJECT_CREATE"] }`
- `conn_123:SEND_MESSAGE` → `{ "conn_123": ["SEND_MESSAGE"] }`

## Troubleshooting

### Issue: Tables Don't Exist

**Solution:** Migrations should run automatically on server start. If not:
```bash
cd apps/mesh
bun run scripts/migrate.ts up
```

### Issue: Scopes Still Missing `mcp:*`

**Check:**
1. Do you see the `/authorize` consent page?
2. Does browser console show: `[Authorize] Updated scopes: ... mcp:*`?
3. Is the server logging the scopes correctly?

**Debug:**
Visit `/debug-auth` to check session state and clear if needed.

### Issue: CORS Errors

**Should NOT happen anymore because:**
- ✅ Sign-in uses `redirect: 'manual'` to prevent auto-following redirects
- ✅ We manually redirect browser to `/authorize` page
- ✅ Better Auth's redirect to client is server-side (HTTP 302)

## Available Pages

- `/sign-in` - Sign in or create account
- `/authorize` - OAuth consent page with permission selection
- `/api-keys` - Manage API keys
- `/debug-auth` - Debug authentication and clear sessions
- `/oauth-test` - Test OAuth endpoints
- `/debug/auth-endpoints` - List all auth endpoints

## CLI Commands

```bash
# Run migrations manually
bun run scripts/migrate.ts up

# Rollback last migration
bun run scripts/migrate.ts down

# Start server (auto-runs migrations)
bun run src/index.ts
```

## What Changed

### ✅ Unified Authentication

**Before:** Split between `api/index.ts` (OAuth) and `context-factory.ts` (API keys)

**After:** All authentication in `context-factory.ts`:
- Tries OAuth session first (getMcpSession)
- Falls back to API key verification
- Both produce the same permission format: `{ [resource]: [actions...] }`

### ✅ Scope-Based Permissions

OAuth scopes are parsed into permissions:
- `mcp:*` grants all management tools
- `mcp:PROJECT_CREATE` grants specific tool
- `conn_123:SEND_MESSAGE` grants connection-specific tool

### ✅ Dynamic Consent UI

The `/authorize` page:
- Fetches available tools from `/api/tools/management`
- Shows checkboxes for each tool
- Auto-selects all by default
- Adds `mcp:*` scope on authorization

### ✅ Database Migrations

Kysely migrations create all required tables:
- Better Auth tables (user, session, account, verification)
- MCP Mesh tables (projects, connections, roles, api_keys, audit_logs)
- OAuth tables (oauth_clients, oauth_authorization_codes, oauth_refresh_tokens)
- Downstream tokens (for caching downstream MCP tokens)

## Next Steps

1. ✅ Restart server to run migrations
2. ✅ Test OAuth flow with MCP client
3. ✅ Verify scopes include `mcp:*`
4. ✅ Test API key creation and usage
5. ✅ Call management tools from MCP client

Everything should now work end-to-end!


# MCP Mesh OAuth Flow Guide

## Overview

MCP Mesh implements OAuth 2.1 with PKCE for secure MCP client authentication. This guide explains the complete flow.

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   MCP Client    │         │  MCP Mesh Auth   │         │  User Browser   │
│  (localhost:    │         │    Server        │         │                 │
│     6274)       │         │ (localhost:3000) │         │                 │
└─────────────────┘         └──────────────────┘         └─────────────────┘
```

## Complete OAuth Flow

### 1. **Client Discovery** (One-time setup)

```bash
# Client fetches OAuth metadata
GET http://localhost:3000/.well-known/oauth-authorization-server

Response:
{
  "issuer": "http://localhost:3000",
  "authorization_endpoint": "http://localhost:3000/api/auth/authorize",
  "token_endpoint": "http://localhost:3000/api/auth/token",
  "registration_endpoint": "http://localhost:3000/api/auth/register",
  "code_challenge_methods_supported": ["S256"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  ...
}
```

### 2. **Authorization Request**

Client redirects user to authorization endpoint:

```
http://localhost:3000/api/auth/authorize
  ?response_type=code
  &client_id=wMrFuZFCAXKVZqvCukcFpOTiyvoYHMLE
  &redirect_uri=http://localhost:6274/oauth/callback
  &state=6c72a3fcec05488b0887795cc778fc0dd10725f0d93820a01ea8205858af6a3e
  &code_challenge=hh3uRl8AjemwTY8nLgebaJEO02PFa0RZP_uiYy5NHfE
  &code_challenge_method=S256
  &scope=openid+profile+email+offline_access
  &resource=http://localhost:3000/
```

### 3. **User Not Authenticated → Redirect to Sign-In**

Better Auth MCP plugin checks if user is authenticated. If not:

```
Redirect to: http://localhost:3000/sign-in?[all OAuth params preserved]
```

### 4. **User Signs In/Up** (on localhost:3000)

User sees the sign-in page and either:
- **Signs In**: `POST /api/auth/sign-in/email`
- **Signs Up**: `POST /api/auth/sign-up/email`

**Important**: This happens entirely on the auth server (localhost:3000). No cross-origin requests.

### 5. **Redirect Back to Authorization**

After successful authentication, JavaScript redirects to:

```
http://localhost:3000/api/auth/authorize?[original OAuth params]
```

### 6. **Better Auth Generates Authorization Code**

Better Auth MCP plugin:
1. ✅ Verifies user is authenticated
2. ✅ Validates PKCE code_challenge
3. ✅ Creates authorization code
4. ✅ **Server-side redirect** to client's redirect_uri

### 7. **Redirect to Client with Code**

Better Auth performs a **server-side HTTP 302 redirect**:

```
HTTP/1.1 302 Found
Location: http://localhost:6274/oauth/callback
  ?code=NNS1nbGSFxuqIJi7DeYwtfRJO3aGrfGn
  &state=6c72a3fcec05488b0887795cc778fc0dd10725f0d93820a01ea8205858af6a3e
```

**No CORS issues** because this is a server-side redirect, not a browser fetch.

### 8. **Client Exchanges Code for Token**

Client (localhost:6274) receives the callback and exchanges code:

```bash
POST http://localhost:3000/api/auth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=NNS1nbGSFxuqIJi7DeYwtfRJO3aGrfGn
&redirect_uri=http://localhost:6274/oauth/callback
&client_id=wMrFuZFCAXKVZqvCukcFpOTiyvoYHMLE
&code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk

Response:
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "def50200...",
  "scope": "openid profile email offline_access"
}
```

### 9. **Client Uses Access Token**

Client makes authenticated requests:

```bash
POST http://localhost:3000/mcp
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 1
}
```

## Client Configuration

### For MCP Clients (e.g., Claude Desktop)

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "mesh": {
      "url": "http://localhost:3000/mcp",
      "transport": {
        "type": "http"
      },
      "authorization": {
        "type": "oauth2",
        "serverUrl": "http://localhost:3000",
        "authorizationEndpoint": "http://localhost:3000/api/auth/authorize",
        "tokenEndpoint": "http://localhost:3000/api/auth/token",
        "scopes": ["openid", "profile", "email", "mcp"]
      }
    }
  }
}
```

**Critical**: The `serverUrl` or equivalent must be set to `http://localhost:3000` so the client knows where to exchange the authorization code for tokens.

## Troubleshooting

### "Missing server url" Error

**Error**: Client shows "missing server url" at the callback

**Cause**: The MCP client doesn't know where to exchange the authorization code

**Fix**: Make sure your client configuration includes:
- `serverUrl: "http://localhost:3000"`, OR
- `authorizationEndpoint` and `tokenEndpoint` explicitly

### CORS Errors

**Error**: CORS errors in browser console

**Cause**: This should NOT happen with our flow because:
1. Sign-in/sign-up happens on localhost:3000 (same origin)
2. The redirect to client is server-side (no CORS)

**If you see CORS errors**: Check that you're not making cross-origin fetch requests from JavaScript. All redirects should be via `window.location.href`.

### Authorization Code Invalid

**Error**: "Invalid authorization code" when exchanging code

**Cause**: PKCE verification failed

**Fix**: Make sure the client sends the same `code_verifier` that was used to generate the `code_challenge`

## Testing the Flow

Visit the test page to verify everything works:

```
http://localhost:3000/oauth-test
```

This page will:
1. ✅ Check OAuth discovery endpoints
2. ✅ Verify your session
3. ✅ Test a complete OAuth flow
4. ✅ Show client configuration

## Key Points

1. ✅ **No CORS Issues**: Sign-in/sign-up stays on localhost:3000
2. ✅ **Server-Side Redirects**: Better Auth redirects to client via HTTP 302
3. ✅ **PKCE Required**: All flows must use PKCE (code_challenge)
4. ✅ **Stateless**: Authorization codes are single-use
5. ✅ **Client Configuration**: Client must know token endpoint URL

## Flow Diagram

```
┌─────────────┐
│ MCP Client  │
│ (port 6274) │
└──────┬──────┘
       │ 1. GET /api/auth/authorize?client_id=...
       ↓
┌──────────────────────────────┐
│   MCP Mesh Auth Server       │
│      (port 3000)             │
└──────┬───────────────────────┘
       │ 2. User not authenticated
       │    Redirect to /sign-in
       ↓
┌─────────────────┐
│ User Browser    │ 3. User signs in/up
│ (localhost:3000)│    POST /api/auth/sign-in/email
└──────┬──────────┘
       │ 4. Success! Redirect to /api/auth/authorize
       ↓
┌──────────────────────────────┐
│   MCP Mesh Auth Server       │ 5. Generate code
│      (port 3000)             │ 6. Server-side redirect
└──────┬───────────────────────┘    HTTP 302
       │
       │ 7. Location: http://localhost:6274/oauth/callback?code=...
       ↓
┌─────────────┐
│ MCP Client  │ 8. Exchange code for token
│ (port 6274) │    POST /api/auth/token
└──────┬──────┘
       │ 9. Use access token
       │    Authorization: Bearer <token>
       ↓
┌──────────────────────────────┐
│   MCP Mesh API               │
│   /mcp endpoint              │
└──────────────────────────────┘
```

## Summary

✅ **Sign-up/Sign-in**: Happens on localhost:3000 (your auth server)  
✅ **No CORS**: All redirects are server-side or same-origin  
✅ **Client Configuration**: Make sure client knows the token endpoint  
✅ **Testing**: Use http://localhost:3000/oauth-test to verify

The "missing server url" error is a **client-side configuration issue**, not a problem with your auth server. The client needs to be configured with your server's URL to exchange the authorization code for tokens.


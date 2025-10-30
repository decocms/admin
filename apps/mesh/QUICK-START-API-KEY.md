# Quick Start: Fixing "Invalid API key" Error

## The Problem

You're getting this error:
```
McpError: MCP error -32001: Error POSTing to endpoint (HTTP 401): {"error":"Invalid API key."}
```

This happens because the `/mcp` endpoint requires authentication, but your MCP Inspector doesn't have credentials yet.

## The Solution: Create an API Key

### Step 1: Sign In

1. Go to: `http://localhost:3000/sign-in`
2. Create an account or sign in

### Step 2: Create an API Key

1. Go to: `http://localhost:3000/api-keys`
2. Fill in:
   - **Key Name**: "MCP Inspector" (or any name you like)
   - **Expiration**: 90 days (or choose another option)
3. Click **"Create API Key"**
4. **IMPORTANT**: Copy the API key immediately! You won't see it again.

It will look like: `mcp_abcd1234...`

### Step 3: Use the API Key in MCP Inspector

Configure your MCP Inspector with the API key:

```json
{
  "url": "http://localhost:3000/mcp",
  "headers": {
    "Authorization": "Bearer mcp_abcd1234..."
  }
}
```

Or if you're using the proxy URL:
```
http://localhost:6277/mcp?url=http://localhost:3000/mcp&auth=Bearer%20mcp_abcd1234...
```

### Step 4: Test the Connection

Try connecting again. You should now be authenticated! ✅

## Alternative: Use OAuth Flow

Instead of API keys, you can use OAuth:

1. Configure your MCP client with OAuth:
```json
{
  "url": "http://localhost:3000/mcp",
  "authorization": {
    "type": "oauth2",
    "serverUrl": "http://localhost:3000",
    "scopes": ["openid", "profile", "email", "mcp"]
  }
}
```

2. The client will redirect you to sign in
3. After authorization, you'll get an access token automatically

## What Changed

I've updated the authentication middleware to support **both**:
- ✅ **OAuth tokens** (via Better Auth MCP plugin)
- ✅ **API keys** (via Better Auth API Key plugin)

Now you can use whichever method works best for your client!

## Available Pages

- `/sign-in` - Sign in or create account
- `/api-keys` - Manage API keys
- `/oauth-test` - Test OAuth flow
- `/authorize` - OAuth consent page

## Troubleshooting

### Still getting 401?

1. **Check the Authorization header**:
   ```
   Authorization: Bearer mcp_your_key_here
   ```
   Make sure "Bearer" is included!

2. **Verify the key is valid**:
   - Go to `/api-keys`
   - Check if the key is listed
   - Check if it's expired

3. **Check the URL**:
   - Endpoint: `http://localhost:3000/mcp`
   - NOT `http://localhost:3000/api/auth/mcp`

### Key got deleted?

Create a new one at `/api-keys` - it takes 10 seconds!

## Next Steps

Once authenticated, you can:
1. ✅ List available MCP tools
2. ✅ Call tools to manage projects
3. ✅ Create connections to other MCP services
4. ✅ Build your MCP mesh!

---

**Need help?** Check the other docs:
- `AUTHENTICATION-SETUP.md` - Complete auth guide
- `OAUTH-FLOW.md` - OAuth flow details


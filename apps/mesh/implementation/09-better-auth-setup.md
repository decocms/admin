# Task 09: Better Auth Setup

## Overview
Configure Better Auth with MCP plugin, API Key plugin, and Admin plugin for authentication and authorization.

## Dependencies
- `02-database-factory.md` (needs database instance)

## Context from Spec

Better Auth provides:
- MCP OAuth 2.1 server (via MCP plugin)
- API key management (via API Key plugin)
- Role-based access control (via Admin plugin)
- Kysely adapter for database

Configuration is file-based (`auth-config.json`), not environment variables.

## Implementation Steps

### 1. Create auth configuration loader

**Location:** `apps/mesh/src/auth/index.ts`

```typescript
import { betterAuth } from 'better-auth';
import { apiKey, admin, mcp } from 'better-auth/plugins';
import { kyselyAdapter } from 'better-auth/adapters/kysely';
import { db } from '../database';
import { readFileSync, existsSync } from 'fs';

/**
 * Load optional auth configuration from file
 */
function loadAuthConfig() {
  const configPath = './auth-config.json';
  
  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Failed to load auth-config.json:', error);
      return {};
    }
  }
  
  return {};
}

/**
 * Better Auth instance with MCP, API Key, and Admin plugins
 */
export const auth = betterAuth({
  database: kyselyAdapter(db),
  
  // Load configuration from file
  ...loadAuthConfig(),
  
  plugins: [
    // MCP plugin for OAuth 2.1 server
    // https://www.better-auth.com/docs/plugins/mcp
    mcp({
      loginPage: '/sign-in',
      resource: process.env.MCP_RESOURCE_URL || 'http://localhost:3000',
    }),
    
    // API Key plugin for direct tool access
    // https://www.better-auth.com/docs/plugins/api-key
    apiKey({
      permissions: {
        defaultPermissions: {
          'mcp': ['PROJECT_LIST', 'PROJECT_GET'], // Default org-level tools
        },
      },
    }),
    
    // Admin plugin for role-based access
    // https://www.better-auth.com/docs/plugins/admin
    admin({
      defaultRole: 'user',
      adminRoles: ['admin'],
    }),
  ],
});

export type BetterAuthInstance = typeof auth;
```

### 2. Create sample auth-config.json

**Location:** `apps/mesh/auth-config.example.json`

```json
{
  "emailAndPassword": {
    "enabled": true
  },
  "socialProviders": {
    "google": {
      "clientId": "your-google-client-id",
      "clientSecret": "your-google-client-secret"
    },
    "github": {
      "clientId": "your-github-client-id",
      "clientSecret": "your-github-client-secret"
    }
  },
  "saml": {
    "enabled": false,
    "providers": []
  }
}
```

### 3. Export auth API helpers

```typescript
/**
 * Helper to create API key
 */
export async function createApiKey(params: {
  userId: string;
  name: string;
  permissions: Record<string, string[]>;
  expiresIn?: number;
}) {
  return await auth.api.createApiKey({
    body: {
      userId: params.userId,
      name: params.name,
      permissions: params.permissions,
      expiresIn: params.expiresIn,
    },
  });
}

/**
 * Helper to verify API key
 */
export async function verifyApiKey(key: string) {
  return await auth.api.verifyApiKey({
    body: { key },
  });
}

/**
 * Helper to check user permission
 */
export async function checkPermission(params: {
  userId: string;
  role?: string;
  permissions?: Record<string, string[]>;
  permission: Record<string, string[]>;
}) {
  return await auth.api.userHasPermission({
    body: params,
  });
}
```

## File Locations

```
apps/mesh/
  src/
    auth/
      index.ts              # Better Auth setup
  auth-config.example.json  # Example configuration
  auth-config.json          # User's actual config (gitignored)
```

## .gitignore Update

Add to `apps/mesh/.gitignore`:
```
auth-config.json
```

## Testing

Create `apps/mesh/src/auth/index.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { auth } from './index';

describe('Better Auth Setup', () => {
  it('should export auth instance', () => {
    expect(auth).toBeDefined();
    expect(auth.api).toBeDefined();
  });

  it('should have MCP plugin methods', () => {
    expect(auth.api.getMcpSession).toBeDefined();
  });

  it('should have API Key plugin methods', () => {
    expect(auth.api.createApiKey).toBeDefined();
    expect(auth.api.verifyApiKey).toBeDefined();
  });

  it('should have Admin plugin methods', () => {
    expect(auth.api.setRole).toBeDefined();
    expect(auth.api.userHasPermission).toBeDefined();
  });
});
```

## Environment Variables

```bash
# Optional: Override MCP resource URL
MCP_RESOURCE_URL=https://mesh.example.com
```

## Validation

- [ ] Better Auth instance created
- [ ] Kysely adapter configured
- [ ] MCP plugin enabled
- [ ] API Key plugin enabled
- [ ] Admin plugin enabled
- [ ] Config loads from auth-config.json if present
- [ ] Helper functions work
- [ ] Tests pass

## Reference

See spec sections:
- **Better Auth Integration** (lines 3502-3575)
- **Authentication via Better Auth** (lines 810-1006)


# Prompt: Auto-Install Deco Store on Organization Creation

## Overview
Implement automatic installation of the official Deco Store (MCP registry) when a new organization is created. This ensures every organization has access to the community registry out of the box.

## Feature Requirements

### 1. **What Should Happen**
- When user creates a new organization via `create-organization-dialog.tsx`
- The Deco Store should be automatically installed as a connection
- User should not see any lag or errors
- Store should be fully functional immediately

### 2. **Deco Store Connection Details**

```typescript
const DECO_STORE_CONFIG = {
  title: "Deco Store",
  description: "Official deco MCP registry with curated integrations",
  connection_type: "HTTP",
  connection_url: "https://api.decocms.com/mcp/registry",
  icon: "https://assets.decocache.com/decocms/00ccf6c3-9e13-4517-83b0-75ab84554bb9/596364c63320075ca58483660156b6d9de9b526e.png",
  app_name: "deco-registry",
  app_id: null,
  connection_token: null,
  connection_headers: null,
  oauth_config: null,
  configuration_state: null,
  configuration_scopes: null,
  metadata: { 
    isDefault: true, 
    type: "registry" 
  },
};
```

### 3. **Registry Tools (to be auto-populated)**

The registry exposes two main tools via `COLLECTION_CONNECTIONS_CREATE`:
```typescript
[
  {
    name: "COLLECTION_REGISTRY_APP_LIST",
    description: "List all public apps in the registry with filtering, sorting, and pagination support",
    // Full schema available from https://api.decocms.com/mcp/registry
  },
  {
    name: "COLLECTION_REGISTRY_APP_GET",
    description: "Get a public app from the registry by ID",
    // Full schema available from https://api.decocms.com/mcp/registry
  }
]
```

## Implementation Steps

### Step 1: Setup - Create Deco Store Config
**File**: `src/web/components/create-organization-dialog.tsx`

```typescript
const DECO_STORE_CONFIG = {
  title: "Deco Store",
  description: "Official deco MCP registry with curated integrations",
  connection_type: "HTTP",
  connection_url: "https://api.decocms.com/mcp/registry",
  icon: "https://assets.decocache.com/decocms/00ccf6c3-9e13-4517-83b0-75ab84554bb9/596364c63320075ca58483660156b6d9de9b526e.png",
  app_name: "deco-registry",
  app_id: null,
  connection_token: null,
  connection_headers: null,
  oauth_config: null,
  configuration_state: null,
  configuration_scopes: null,
  metadata: { 
    isDefault: true, 
    type: "registry" 
  },
};
```

### Step 2: Create Install Function
**File**: `src/web/components/create-organization-dialog.tsx`

```typescript
async function installDecoStore(): Promise<void> {
  try {
    const toolCaller = createToolCaller();
    await toolCaller("COLLECTION_CONNECTIONS_CREATE", {
      data: DECO_STORE_CONFIG,
    });
  } catch {
    // Non-blocking: don't interrupt org creation if store install fails
  }
}
```

**Key Points:**
- Use `createToolCaller()` without connectionId (mesh API level)
- Call `COLLECTION_CONNECTIONS_CREATE` tool
- Pass complete config with metadata and app_name
- Catch errors silently (non-blocking)
- No logging in production code

### Step 3: Call During Organization Creation
**File**: `src/web/components/create-organization-dialog.tsx`

In the `onSubmit` function after successful organization creation:

```typescript
if (result?.data?.slug) {
  const orgSlug = result.data.slug;
  
  // Install Deco Store after organization creation
  await installDecoStore();
  
  // Navigate to the new organization
  navigate({ to: "/$org", params: { org: orgSlug } });
  onOpenChange(false);
  form.reset();
}
```

**Location:** After `authClient.organization.create()` succeeds but before navigation

## Code Quality Requirements

### Testing & Validation
```bash
# Run all checks before committing
npm run fmt      # Format code
npm run lint     # Lint check (0 warnings/errors required)
npm run check    # TypeScript check
npm run knip     # Unused code check
```

### Rules
- ✅ No console.log in production code
- ✅ No unused variables/imports
- ✅ TypeScript: strict mode, no any types
- ✅ Non-blocking errors (catch silently)
- ✅ Simple, minimal implementation

## Import Requirements

```typescript
// Already available in create-organization-dialog.tsx
import { createToolCaller } from "@/tools/client";

// Already available
import { authClient } from "@/web/lib/auth-client";
import { useNavigate } from "@tanstack/react-router";
```

## Data Flow Diagram

```
User clicks "Create Organization"
           ↓
authClient.organization.create({ name, slug })
           ↓
         [Success]
           ↓
     installDecoStore()
           ↓
    createToolCaller()
           ↓
  COLLECTION_CONNECTIONS_CREATE
           ↓
   [Store installed in DB]
           ↓
   navigate to /$org
           ↓
User sees org with Deco Store ready
```

## Expected Result

After organization creation:
- User can immediately navigate to `/store` page
- Deco Store is visible in the registry selector
- Can browse and install MCPs from the registry
- No manual setup needed
- Works for all new organizations created

## Edge Cases & Error Handling

1. **Install fails**: Silently caught, org creation still succeeds
2. **Network timeout**: Non-blocking, user can manually add later
3. **Duplicate attempt**: Tool will handle gracefully on backend
4. **User refresh**: Collection will be persisted in DB

## Success Criteria

- ✅ `npm run fmt` - 0 fixes
- ✅ `npm run lint` - 0 warnings
- ✅ `npm run check` - passes TypeScript
- ✅ `npm run knip` - 0 unused code
- ✅ Create org → Store auto-installed
- ✅ No errors in browser console
- ✅ No errors in server logs

## Files to Modify

1. `src/web/components/create-organization-dialog.tsx`
   - Add DECO_STORE_CONFIG constant
   - Add installDecoStore() function
   - Call installDecoStore() in onSubmit

## No Changes Needed In

- ✅ Database/migrations (tools handle it)
- ✅ Backend auth (no hooks needed)
- ✅ Store page UI (no changes)
- ✅ Collections (auto-populated)

## References

- Tool: `COLLECTION_CONNECTIONS_CREATE` in `src/tools/connection/create.ts`
- Client: `createToolCaller()` in `src/tools/client.ts`
- Dialog: `src/web/components/create-organization-dialog.tsx`
- Deco API: https://api.decocms.com/mcp/registry

---

## Summary

**Single file, ~30 lines of code**
- Add config object
- Add install function (5-10 lines)
- Call on org creation (1 line)
- Clean, minimal, zero dependencies


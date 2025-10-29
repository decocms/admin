# Tasks 12-26: Remaining Implementation Files

This document provides an overview of the remaining implementation tasks. Each can be expanded into a full implementation file when needed.

## Phase 4: API Layer (Continued)

### Task 12: Middleware - Authentication
**File:** `12-middleware-auth.md`
**Location:** `apps/mesh/src/api/middlewares/auth.ts`

Verify Bearer tokens and populate user/API key in context.
- Check Authorization header
- Verify with Better Auth
- Handle MCP OAuth sessions
- Return 401 with WWW-Authenticate on failure

---

### Task 13: Middleware - Tool Execution Routes
**File:** `13-tool-execution-routes.md`
**Location:** `apps/mesh/src/api/routes/tools.ts`

Mount tool execution endpoints.
- POST /mcp/tools/:toolName (organization-scoped)
- POST /:project/mcp/tools/:toolName (project-scoped)
- Look up tool from registry
- Call tool.execute()
- Return MCP-formatted response

---

## Phase 5: Core Tools

### Task 14: Project Management Tools
**File:** `14-tools-project.md`
**Location:** `apps/mesh/src/tools/project/`

Implement:
- `PROJECT_CREATE` - Create new project (namespace)
- `PROJECT_LIST` - List user's projects  
- `PROJECT_GET` - Get project details
- `PROJECT_UPDATE` - Update project
- `PROJECT_DELETE` - Delete project
- `PROJECT_MEMBER_ADD` - Add member to project
- `PROJECT_MEMBER_REMOVE` - Remove member

Each uses `defineTool` pattern with Zod schemas.

---

### Task 15: Connection Management Tools
**File:** `15-tools-connection.md`
**Location:** `apps/mesh/src/tools/connection/`

Implement:
- `CONNECTION_CREATE` - Create MCP connection (org or project scoped)
- `CONNECTION_LIST` - List connections (with scope filter)
- `CONNECTION_GET` - Get connection details
- `CONNECTION_UPDATE` - Update connection
- `CONNECTION_DELETE` - Delete connection
- `CONNECTION_TEST` - Test connection health

Handles:
- Organization vs project scoping (projectId null vs string)
- OAuth config storage (encrypted)
- Tool discovery
- Binding detection

---

### Task 16: Policy Management Tools
**File:** `16-tools-policy.md`
**Location:** `apps/mesh/src/tools/policy/`

Implement:
- `POLICY_CREATE` - Create access policy
- `POLICY_LIST` - List policies
- `POLICY_UPDATE` - Update policy statements
- `POLICY_DELETE` - Delete policy

Storage needed: `apps/mesh/src/storage/policy.ts`

---

### Task 17: Role Management Tools
**File:** `17-tools-role.md`
**Location:** `apps/mesh/src/tools/role/`

Implement:
- `ROLE_CREATE` - Create role with permissions
- `ROLE_LIST` - List roles
- `ROLE_UPDATE` - Update role permissions
- `ROLE_DELETE` - Delete role

Storage needed: `apps/mesh/src/storage/role.ts`

Uses Better Auth permission format: `{ [resource]: [actions...] }`

---

### Task 18: Token Management Tools
**File:** `18-tools-token.md`
**Location:** `apps/mesh/src/tools/token/`

Implement:
- `TOKEN_CREATE` - Create API key via Better Auth
- `TOKEN_LIST` - List user's API keys
- `TOKEN_REVOKE` - Revoke API key

Uses Better Auth API Key plugin methods.

Storage needed: `apps/mesh/src/storage/token-revocation.ts` (for instant revocation)

---

## Phase 6: Advanced Features

### Task 19: MCP Proxy Routes
**File:** `19-proxy-routes.md`
**Location:** `apps/mesh/src/api/routes/proxy.ts`

Implement proxy endpoint:
- POST /mcp/:connectionId
- Validate connection access
- Get/decrypt connection credentials
- Handle downstream OAuth if needed
- Proxy request with proper headers
- Propagate W3C trace context
- Log to audit trail

**Key features:**
- Replace Mesh token with actual service token
- Support organization-scoped connections (globally unique IDs)
- Cache downstream OAuth tokens
- Handle token refresh

---

### Task 20: MCP Bindings System
**File:** `20-bindings.md`
**Location:** `apps/mesh/src/core/bindings.ts`

Define standard bindings:
- `CHAT_BINDING` - Messaging interface (SEND_MESSAGE, LIST_THREADS, etc.)
- `EMAIL_BINDING` - Email operations (SEND_EMAIL, LIST_EMAILS, etc.)
- `STORAGE_BINDING` - File storage (UPLOAD_FILE, DOWNLOAD_FILE, etc.)

Implement binding detector:
- Check which tools a connection provides
- Match against binding definitions
- Store detected bindings in connection record

Enables:
- Provider polymorphism
- Generic UI components
- Marketplace filtering

---

### Task 21: Observability Setup
**File:** `21-observability.md`
**Location:** `apps/mesh/src/observability/index.ts`

Configure OpenTelemetry:
- Initialize NodeSDK
- Configure OTLP exporters (traces + metrics)
- Create tracer and meter instances
- Define standard metrics:
  - `tool.execution.duration`
  - `tool.execution.count`
  - `tool.execution.errors`
  - `connection.proxy.requests`
  - `connection.proxy.errors`

Already integrated in `defineTool` wrapper.

---

### Task 22: Downstream OAuth Client
**File:** `22-oauth-downstream.md`
**Location:** `apps/mesh/src/auth/downstream-oauth.ts`

Implement OAuth client for connecting to downstream MCPs:
- `discoverDownstreamOAuth()` - Parse protected resource metadata
- `getDownstreamToken()` - Get/cache tokens for downstream MCP
- `refreshDownstreamToken()` - Refresh expired tokens
- OAuth callback handler for authorization_code flow

Storage needed: `apps/mesh/src/storage/downstream-token.ts`

**Important:** OAuth discovery happens ONCE when creating connection, not on every proxy request.

---

## Phase 7: Additional Storage & Tools

### Task 23: Audit Log Storage
**File:** `23-storage-audit.md`
**Location:** `apps/mesh/src/storage/audit-log.ts`

Implement:
- `log()` - Create audit log entry
- `query()` - Query logs with filters
- `stats()` - Aggregate usage statistics

Already called automatically by `defineTool` wrapper.

---

### Task 24: Team Storage
**File:** `24-storage-teams.md`
**Location:** `apps/mesh/src/storage/team.ts`

Implement:
- `create()` - Create team
- `list()` - List teams
- `addMember()` - Add user to team with roles
- `removeMember()` - Remove user from team
- `updateMemberRoles()` - Update member's roles

---

### Task 25: Team Management Tools
**File:** `25-tools-team.md`
**Location:** `apps/mesh/src/tools/team/`

Implement:
- `TEAM_CREATE` - Create team
- `TEAM_LIST` - List teams
- `TEAM_MEMBER_ADD` - Add member
- `TEAM_MEMBER_REMOVE` - Remove member
- `TEAM_MEMBER_UPDATE_ROLES` - Update roles

---

### Task 26: Audit Query Tools
**File:** `26-tools-audit.md`
**Location:** `apps/mesh/src/tools/audit/`

Implement:
- `AUDIT_QUERY` - Query audit logs with filters
- `AUDIT_STATS` - Get usage statistics

Filters:
- userId
- connectionId
- toolName
- dateRange
- allowed/denied

---

## Implementation Priority

**Critical Path:**
1. Tasks 1-11 (Foundation + API layer) ✅
2. Task 14 (Project tools) - Needed for namespace management
3. Task 15 (Connection tools) - Core functionality
4. Task 19 (Proxy) - Makes connections usable
5. Tasks 16-18 (Policies, Roles, Tokens) - Access control
6. Tasks 23, 26 (Audit) - Observability
7. Tasks 20-22 (Bindings, OAuth) - Advanced features
8. Tasks 24-25 (Teams) - Organization features

**Testing Strategy:**

Each task should include:
1. Implementation file with full code
2. Unit tests for business logic
3. Integration tests where applicable
4. Validation checklist

Run tests incrementally:
```bash
bun test apps/mesh/src/tools/project
bun test apps/mesh/src/tools/connection
# etc.
```

**Next Steps:**

To expand any of these tasks into full implementation files:
1. Copy the structure from tasks 01-11
2. Add detailed implementation steps
3. Include complete code examples
4. Add comprehensive tests
5. Reference spec sections

---

## Quick Reference: File Structure

```
apps/mesh/src/
  api/
    index.ts                    # Task 11
    middlewares/
      auth.ts                   # Task 12
    routes/
      tools.ts                  # Task 13
      proxy.ts                  # Task 19
  
  tools/
    project/                    # Task 14
      create.ts, list.ts, get.ts, update.ts, delete.ts
      member-add.ts, member-remove.ts
    connection/                 # Task 15
      create.ts, list.ts, get.ts, update.ts, delete.ts, test.ts
    policy/                     # Task 16
      create.ts, list.ts, update.ts, delete.ts
    role/                       # Task 17
      create.ts, list.ts, update.ts, delete.ts
    token/                      # Task 18
      create.ts, list.ts, revoke.ts
    team/                       # Task 25
      create.ts, list.ts, member-add.ts, member-remove.ts
    audit/                      # Task 26
      query.ts, stats.ts
  
  storage/
    policy.ts                   # Task 16
    role.ts                     # Task 17
    team.ts                     # Task 24
    audit-log.ts                # Task 23
    downstream-token.ts         # Task 22
    token-revocation.ts         # Task 18
  
  core/
    bindings.ts                 # Task 20
    binding-detector.ts         # Task 20
  
  auth/
    downstream-oauth.ts         # Task 22
  
  observability/
    index.ts                    # Task 21
```


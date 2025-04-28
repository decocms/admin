# API System Requirements

## Core Features

### CRUD Operations

The system requires CRUD (Create, Read, Update, Delete) operations for the
following entities:

- Agents
  - Fields: id (uuid), name, avatar, instructions, description, tools_set
    (jsonb), max_steps, max_tokens, model, memory (jsonb), views (jsonb),
    created_at, workspace, draft
  - Primary Key: id
  - Required fields: name, avatar, instructions, tools_set, workspace

- Integrations
  - Fields: id (uuid), name, description, icon, connection (jsonb), created_at,
    workspace
  - Primary Key: id
  - Required fields: name, connection, workspace

- Profiles
  - Fields: id (bigint), created_at, name, user_id (uuid), email, deco_user_id,
    is_new_user
  - Primary Key: id
  - Foreign Keys: user_id (references auth.users), deco_user_id (references
    deco_users)
  - Required fields: user_id, email

- Teams
  - Fields: id (bigint), created_at, name, stripe_subscription_id, slug
  - Primary Key: id
  - Required fields: name
  - Unique constraint: slug

- Members
  - Fields: id (bigint), created_at, user_id, team_id, admin,
    stripe_customer_id, deleted_at, activity (jsonb[])
  - Primary Key: id
  - Foreign Keys: team_id (references teams), user_id (references
    profiles.user_id)
  - Unique constraint: (user_id, team_id)

### Workspace Management

- List all workspaces
- Profile management (CRUD operations)
- Authentication via Supabase OAuth
- Team management (CRUD operations)
- Team member management (list members, add members to team)

## Technical Stack

- Runtime: Deno
- Database: Supabase (using Drizzle ORM)
- Server: Abstracted server implementation (see app.ts)

## Initial Implementation

The initial implementation is present in `app.ts` and includes:

- Base class structure for the API
- Method stubs for Agents and Integrations CRUD operations
- Type definitions for Agent and Integration entities
- Server abstraction layer, no need to create any http related low lever server
  things

## MCP (Microservice Control Plane) Requirements

Two separate MCP instances need to be created:

1. Primary MCP: Exposed under `/workspace/mcp/`
2. Secondary MCP: Exposed under `/miscelaneous/mcp/`

## Implementation Details

### Authentication & Authorization

- Authentication is handled through Supabase OAuth
- User profiles are linked to auth.users table
- Team membership includes admin flag for role-based access control

### Data Validation

- UUID fields must be valid UUIDs
- Required fields must not be null
- Email fields must be valid email addresses
- JSONB fields must contain valid JSON
- Team slugs must be unique
- Member combinations of user_id and team_id must be unique
- All entities must be validated using Zod schemas from @deco/sdk:
  - Agents must be validated using `AgentSchema`
  - Integrations must be validated using `IntegrationSchema`
  - These schemas provide type safety and runtime validation

### Response Formats

- All responses should include:
  - Success/error status
  - Data payload
  - Timestamp
  - Error details (if applicable)

### Security Requirements

- All endpoints must be authenticated
- Team-specific operations must verify team membership
- Admin operations must verify admin status
- Rate limiting should be implemented for public endpoints

### Error Handling

- Use appropriate HTTP status codes
- Include detailed error messages
- Log errors for debugging
- Handle database constraint violations gracefully

### Performance Considerations

- Implement proper indexing (already present in schema)
- Use pagination for list operations
- Cache frequently accessed data
- Optimize database queries

### Additional Notes

- The system includes audit triggers for tracking changes
- Soft delete is implemented for members (deleted_at field)
- Activity tracking is available for members (activity jsonb array)
- Integration with Stripe for subscription management

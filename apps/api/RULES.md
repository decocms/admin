# API System Requirements

## Core Features

### CRUD Operations
The system requires CRUD (Create, Read, Update, Delete) operations for the following entities:
- Agents
- Integrations
- Chrons
- Threads

### Workspace Management
- List all workspaces
- Profile management (CRUD operations)
- Authentication via Supabase OAuth
- Team management (CRUD operations)
- Team member management (list members, add members to team)

## Technical Stack
- Backend Framework: Hono
- Runtime: Deno
- Database: Supabase (using Drizzle ORM)

## MCP (Microservice Control Plane) Requirements
Two separate MCP instances need to be created:
1. Primary MCP: Exposed under `/workspace/mcp/`
2. Secondary MCP: Exposed under `/miscelaneous/mcp/`

## Questions for Clarification
1. What specific fields and relationships are needed for each CRUD entity (Agents, Integrations, Chrons, Threads)?
2. What authentication requirements are needed beyond Supabase OAuth?
3. What specific team-related operations are needed (e.g., team roles, permissions)?
4. Are there any specific validation rules or business logic for the CRUD operations?
5. What are the expected response formats for the API endpoints?
6. Are there any rate limiting or security requirements?
7. What are the specific requirements for the MCP instances? (Please refer to ./MCP.md for implementation details)
8. Are there any specific performance or scalability requirements?
9. What are the error handling and logging requirements?
10. Are there any specific API versioning requirements?

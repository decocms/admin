# Workspace to Project ID Migration Plan

## Overview

Migrate the codebase from workspace-based queries to project ID-based queries. This will allow entities to be scoped by project rather than workspace, enabling better multi-project support within a single workspace.

## Context

Currently, most database queries filter by `workspace` column. The goal is to transition to using `projectId` (or `orgId`) as the primary filter, while maintaining backward compatibility during the migration.

## Migration Strategy

This migration is broken down into multiple PRs to ensure safety and allow incremental rollout to production.

---

## PR #1: Support Both Workspace AND Project ID

### Goal
Update all API queries to match by EITHER workspace OR projectId, maintaining full backward compatibility.

### Changes Required

1. **Utility Function**
   - Create `workspaceOrProjectIdConditions()` helper in `packages/sdk/src/mcp/projects/util.ts`
   - This function returns conditions that match by workspace OR project locator

2. **Update All API Files**
   Replace direct workspace equality checks with the new utility:
   
   ```typescript
   // OLD
   .eq("workspace", c.workspace.value)
   
   // NEW
   ...workspaceOrProjectIdConditions(c)
   ```

   Apply this pattern across all API files in `packages/sdk/src/mcp/*/api.ts`

### Testing
- All existing tests should pass
- Production should work identically after deployment
- No observable behavior changes for end users

### Success Criteria
- All queries work with both workspace-only entities and project-scoped entities
- Zero breaking changes
- Production deployment is seamless

---

## PR #2: Make Workspace Column Optional

### Goal
Make the `workspace` column nullable in the database and test with projects where `workspace = null`.

### Changes Required

1. **Database Schema Updates**
   - Update column definitions to allow NULL for workspace
   - Create migration scripts in `supabase/migrations/`

2. **Local Testing**
   - Create test projects with `workspace = null`
   - Verify all functionality works:
     - CRUD operations
     - List/filter operations
     - Authorization checks
     - Related entity queries (joins, foreign keys)

3. **Code Updates**
   - Update TypeScript types to reflect nullable workspace
   - Add runtime checks where needed
   - Update validation logic

### Testing
- Create, read, update, delete operations with workspace = null
- List entities across workspace and project boundaries
- Authorization rules still work correctly
- All API endpoints work with mixed workspace/project data

### Success Criteria
- Projects can exist without a workspace value
- All features work identically for workspace-null projects
- No errors or null pointer exceptions

---

## PR #3: Migrate Existing Data

### Goal
Populate `projectId` or `orgId` on all existing entities and begin transitioning code to use project ID exclusively.

### Changes Required

1. **Migration Scripts**
   Create data migration scripts to:
   - Populate `projectId` for all workspace-scoped entities
   - Populate `orgId` where appropriate
   - Verify data integrity after migration
   
   Scripts should be:
   - Idempotent (safe to run multiple times)
   - Reversible (in case of issues)
   - Logged (track what was changed)

2. **Gradual Code Migration**
   Start changing queries to use project ID exclusively:
   
   ```typescript
   // FROM
   ...workspaceOrProjectIdConditions(c)
   
   // TO
   const projectId = await getProjectIdFromContext(c);
   .eq("project_id", projectId)
   ```

   Migrate in batches:
   - Start with least critical tables
   - Monitor for issues in production
   - Continue with more critical tables

3. **Testing**
   - Test in staging environment first
   - Run migration on production copy
   - Verify all data is correctly populated
   - Spot check various entity types

### Success Criteria
- All entities have proper project ID or org ID populated
- Code gradually transitions to project-based queries
- Zero data loss or corruption
- Production continues working smoothly

---

## PR #4: Remove Workspace Column

### Goal
Complete the migration by removing the deprecated `workspace` column entirely.

### Prerequisites
- PR #3 has been in production for at least 1-2 weeks without issues
- All code has been migrated to use project ID
- No references to workspace column remain in codebase

### Changes Required

1. **Code Cleanup & Query Optimization**
   - Remove `workspace` field from TypeScript interfaces
   - Remove `workspaceOrProjectIdConditions()` helper
   - **Migrate from Supabase to Drizzle ORM queries** to avoid two-query pattern
   - Use Drizzle joins to resolve project ID from locator in a single query:
     ```typescript
     // Instead of: getProjectIdFromContext() then separate query
     // Use: single query with join
     // Drizzle relational query api can also be used to make code simpler sometimes
     // also look into $dynamic maybe.
     const results = await c.drizzle
       .select()
       .from(entities)
       .innerJoin(projects, eq(entities.project_id, projects.id))
       .where(eq(projects.slug, c.locator.project))
     ```
   - Extract common query patterns into reusable Drizzle helpers
   - Remove workspace-related validation logic

2. **Database Migration**
   - Create migration to drop workspace column
   - Ensure no foreign key constraints remain
   - Update database indexes

3. **Documentation**
   - Update API documentation
   - Update developer guides
   - Add migration notes to changelog

### Testing
- Full regression test suite
- Manual testing of critical flows
- Load testing to ensure performance
- Verify all queries still work efficiently

### Success Criteria
- Workspace column completely removed from database
- No references to workspace in codebase
- All functionality works as expected
- Performance is maintained or improved

---

## Rollback Plan

If issues are discovered at any stage:

1. **PR #1**: Revert the deployment - workspace queries still work natively
2. **PR #2**: No data has changed yet, just revert code changes
3. **PR #3**: Migration scripts should be reversible - run rollback script
4. **PR #4**: This is the point of no return - thorough testing before this step

---

## Sequencing

Each PR should be completed and merged before starting the next one to ensure stability at each step.

---

## Notes

- Monitor error rates and performance metrics closely during each deployment
- Communicate changes to team before each PR
- Update this document as the migration progresses


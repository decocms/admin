# Knip Cleanup Task Summary

## Quick Reference

**Goal**: Make `bun knip` return 0 errors for unused exports and duplicate exports.

**Current State**:
- 17 Duplicate exports (PRIORITY: Fix these first)
- 282 Unused exports (Fix systematically by directory)

## Quick Commands

```bash
# Check knip errors
bun knip

# Verify TypeScript compilation (run occasionally, every 10-15 edits)
bun check

# Search for usage of an export
grep -r "exportName" /Users/viktor/repos/admin --include="*.ts" --include="*.tsx"
```

## Order of Operations

1. **Phase 1: Fix Duplicate Exports** (~17 files)
   - apps/api/src/{api.ts, app.ts, apps.ts}
   - Various React components with duplicate default exports
   - packages/runtime/src/resources.ts
   - packages/sdk/src/models/trigger.ts

2. **Phase 2: Fix Unused Exports by Directory** (~282 exports)
   - Start: `apps/api/src/`
   - Then: `apps/outbound/`
   - Then: `apps/mesh/src/`
   - Then: `apps/web/src/` (largest section)
   - Finally: `packages/` directories

## Key Principles

✅ **DO:**
- Read files before editing
- Verify with grep before removing
- Run `bun knip` after each batch (5-10 files)
- Run `bun check` every 10-15 edits
- Be cautious with MCP API exports
- Keep exports if uncertain

❌ **DON'T:**
- Fix "Unused dependencies" or "Unlisted dependencies" (config issues)
- Blindly remove exports without verification
- Remove exports from MCP API files without checking
- Break TypeScript compilation

## Workflow Loop

```
while (bun knip shows errors) {
  1. Identify 5-10 files to fix
  2. Read each file and understand context
  3. Make targeted changes (remove unused, fix duplicates)
  4. Run: bun knip
  5. Every ~15 edits: bun check
  6. If errors: fix immediately
  7. Report progress
}
```

## High-Risk Files (Be Extra Careful)

- `apps/api/src/api.ts` - Main API routes
- `apps/api/src/app.ts` - App initialization
- `packages/sdk/src/mcp/*/api.ts` - MCP protocol APIs
- Any `index.ts` files - Barrel exports
- Files with "default" exports - Check import usage patterns

## Common Fixes

### Duplicate Export Fix
```typescript
// Before (duplicate)
export const app = hono()
export default app

// After (choose based on actual imports)
export default app
```

### Unused Export Fix
```typescript
// Before
export const unusedFunction = () => {}

// After (if truly unused via grep verification)
// Just remove it entirely or remove 'export' keyword
const unusedFunction = () => {} // If used internally
// OR delete the whole thing if not used at all
```

## Progress Tracking

Track in comments as you go:
- Batch X: Fixed N unused exports in directory Y
- Batch X: Fixed N duplicate exports  
- Current knip errors: N
- Any TypeScript errors: Yes/No

## Success Criteria

```bash
$ bun knip
✔ No issues found!
```

Specifically:
- 0 Duplicate exports
- 0 Unused exports
- `bun check` passes with no new errors


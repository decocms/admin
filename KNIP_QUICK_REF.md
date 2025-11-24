# KNIP Cleanup - Quick Reference Card

## Current Task
Fix all unused exports and duplicate exports until `bun knip` shows 0 errors.

## Quick Commands
```bash
bun knip                    # Check current errors
bun check                   # TypeScript compilation check
grep -r "name" . --include="*.ts" --include="*.tsx"  # Search usage
```

## Current Progress Template
```
Phase: [1-Duplicates / 2-Unused]
Current Errors: [N] duplicate, [N] unused
Last Batch: Fixed [N] in [directory/files]
Next Target: [file or directory]
```

## Fix Checklist Per Export
- [ ] Read file containing export
- [ ] Grep search for usage
- [ ] Verify it's truly unused/duplicate
- [ ] Make the fix (remove/modify)
- [ ] Note the change
- [ ] After 5-10 fixes: Run `bun knip`
- [ ] After 15 fixes: Run `bun check`

## Common Fix Patterns

### Duplicate Export
```typescript
// BEFORE
export const app = hono()
export default app

// AFTER (choose one based on imports)
export default app
```

### Unused Export
```typescript
// BEFORE
export const unused = () => {}

// AFTER (if truly unused)
// [removed entirely]
```

## Stop Conditions
✅ `bun knip` shows 0 duplicate exports
✅ `bun knip` shows 0 unused exports  
✅ `bun check` passes

## Danger Zones (Verify Carefully)
- `packages/sdk/src/mcp/*/api.ts`
- `apps/api/src/api.ts`
- Files with `Schema` in name
- `index.ts` barrel exports

## Phase 1 Targets (17 files)
Duplicate exports in:
- apps/api/src/{api,app,apps}.ts
- apps/web/src/components/{agents,documents,onboarding,settings,tools,triggers,views,workflows}/*
- packages/runtime/src/resources.ts
- packages/sdk/src/models/trigger.ts

## Phase 2 Strategy
1. apps/api/src/ (~11)
2. apps/outbound/ (~11)
3. apps/mesh/src/ (~10)
4. apps/web/src/ (~150+)
5. packages/ (~100)

## Loop Structure
```
while (errors > 0):
    1. bun knip → note errors
    2. Fix 5-10 exports
    3. bun knip → verify
    4. Every 15: bun check
    5. Report progress
```

## When Uncertain
**KEEP THE EXPORT** - Better safe than breaking the build.
Move to next one and report uncertainty.


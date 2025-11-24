# KNIP CLEANUP MISSION - PROMPT FOR AI ASSISTANT

Copy this entire prompt to your AI assistant (Claude Sonnet 3.5 or similar):

---

## YOUR MISSION

You are tasked with cleaning up unused exports and duplicate exports in a TypeScript/React monorepo until the command `bun knip` returns no errors for these categories.

## CRITICAL RULES

1. **ONLY** fix "Unused exports" and "Duplicate exports"
2. **IGNORE** other knip warnings (Unused dependencies, Unlisted dependencies, etc.)
3. **ALWAYS** verify with grep before removing exports
4. **RUN** `bun knip` after every 5-10 file edits
5. **RUN** `bun check` every 10-15 edits to ensure TypeScript compiles
6. **STOP** when `bun knip` shows 0 duplicate exports and 0 unused exports

## CURRENT STATUS

Run this first to see current errors:
```bash
bun knip
```

You should see:
- **17 Duplicate exports** (FIX THESE FIRST)
- **282 Unused exports** (Fix systematically after duplicates)

## PHASE 1: Fix Duplicate Exports (START HERE)

Duplicate exports happen when the same identifier is exported multiple times from one file. 

**Steps:**
1. Read the file mentioned in the duplicate export error
2. Identify which export format is actually used (use grep to check imports)
3. Remove the unused export format
4. Verify with `bun knip`

**Example files to fix first:**
- `apps/api/src/api.ts` - likely has both `export { app }` and `export default app`
- `apps/api/src/app.ts` - same pattern
- `apps/api/src/apps.ts` - same pattern
- Various React component files with duplicate default exports

**How to check usage:**
```bash
grep -r "from './api'" apps/api/src --include="*.ts" --include="*.tsx"
# Check if imports use: import app from './api' OR import { app } from './api'
```

## PHASE 2: Fix Unused Exports (AFTER DUPLICATES ARE DONE)

Work directory by directory:

### Order:
1. `apps/api/src/` (~11 unused exports)
2. `apps/outbound/` (~11 unused exports)  
3. `apps/mesh/src/` (~10 unused exports)
4. `apps/web/src/` (~150+ unused exports - largest section)
5. `packages/` directories (~100 unused exports)

### Steps for each unused export:
1. Read the file containing the export
2. Search for usage: `grep -r "exportName" . --include="*.ts" --include="*.tsx"`
3. If truly unused (no grep results), remove the `export` keyword or delete the declaration
4. If uncertain (e.g., MCP API exports, types), KEEP IT and skip to next one

### Special attention for:
- **MCP APIs** (`packages/sdk/src/mcp/*/api.ts`): Exports might be used via MCP protocol, be very careful
- **Types/Interfaces**: May be used in ways grep doesn't catch, be cautious
- **Default exports on React components**: Check if used in routing/lazy loading

## VERIFICATION COMMANDS

```bash
# After each batch of 5-10 files
bun knip

# Every 10-15 edits  
bun check

# Search for export usage
grep -r "exportName" /Users/viktor/repos/admin --include="*.ts" --include="*.tsx"
```

## EXAMPLE FIX - Duplicate Export

**Before:**
```typescript
// apps/api/src/api.ts
export const app = new Hono()
// ... routes ...
export default app  // DUPLICATE!
```

**Check imports:**
```bash
grep -r "from './api'" apps/api/src
# Results show: import app from './api'
```

**Fix (keep default, remove named):**
```typescript
// apps/api/src/api.ts
const app = new Hono()  // Remove export keyword
// ... routes ...
export default app
```

## EXAMPLE FIX - Unused Export

**Before:**
```typescript
// apps/web/src/utils/format.ts
export const formatResourceName = (name: string) => name.toUpperCase()
```

**Check usage:**
```bash
grep -r "formatResourceName" apps/web/src
# No results!
```

**Fix (remove entire function if truly unused):**
```typescript
// apps/web/src/utils/format.ts
// (function removed entirely)
```

OR if used internally in same file:
```typescript
// apps/web/src/utils/format.ts
const formatResourceName = (name: string) => name.toUpperCase() // Remove export
```

## WORKFLOW LOOP

Execute this loop until complete:

```
LOOP:
  1. Run: bun knip
  2. Note current error count
  3. Pick next 5-10 files to fix
  4. For each file:
     a. Read file
     b. Verify with grep  
     c. Make fix
  5. Run: bun knip (verify progress)
  6. Every 15 edits: Run bun check
  7. If bun check fails: Fix TypeScript errors immediately
  8. Report progress: "Batch N: Fixed X exports, Y remaining"
  9. GOTO LOOP (unless errors = 0)
```

## SUCCESS CRITERIA

When you see this, you're done:

```bash
$ bun knip
✔ No issues found!
```

AND `bun check` passes without errors.

## IMPORTANT WARNINGS

⚠️ **DO NOT REMOVE** exports from these without careful verification:
- `packages/sdk/src/mcp/*/api.ts` - MCP APIs may be used via protocol
- Any file with `Schema` in name - May be validation schemas used dynamically
- Files in `auth/` directories - May be used in authentication flows
- `index.ts` barrel exports - Check re-export usage

⚠️ **IF UNCERTAIN**: Keep the export and skip to the next one. Better safe than breaking the build.

## START NOW

Begin by running:
```bash
bun knip
```

Then start with **Phase 1: Duplicate Exports** (the 17 duplicate export errors). Fix those first, then move to Phase 2.

Report your progress after each batch and keep looping until complete. Good luck! 🚀


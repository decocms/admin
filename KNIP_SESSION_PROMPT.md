# Knip Cleanup Session - Quick Start

> Use this for starting a new session if the AI needs a reminder

---

## Your Task
Fix knip errors by removing unused exports and duplicate exports.

## Commands You'll Use
```bash
# Check current errors
bun knip

# Verify TypeScript (every ~15 edits)
bun check

# Search for usage
grep -r "exportName" . --include="*.ts" --include="*.tsx"
```

## Workflow (Loop Until Done)

```
REPEAT:
  1. Run: bun knip
  2. Identify next 5-10 files
  3. For each file:
     - Read file
     - Grep for usage
     - Remove export or fix duplicate
  4. Run: bun knip (verify)
  5. After 15 edits: bun check
  6. Update KNIP_PROGRESS.md
END WHEN: bun knip shows 0 duplicate, 0 unused exports
```

## What to Fix

### 1. Duplicate Exports (FIX FIRST - 17 total)
When same name exported twice from one file:

```typescript
// BAD
export const app = hono()
export default app  // duplicate!

// FIX (check imports first)
export default app  // keep this if imported as default
```

### 2. Unused Exports (282 total)  
When export is never imported anywhere:

```typescript
// BAD  
export const unused = () => {}

// FIX (if grep shows no usage)
// Delete it or remove 'export'
```

## Priority Order
1. ✅ Fix all 17 duplicate exports
2. ✅ Fix unused in: apps/api/src/
3. ✅ Fix unused in: apps/outbound/
4. ✅ Fix unused in: apps/mesh/src/
5. ✅ Fix unused in: apps/web/src/
6. ✅ Fix unused in: packages/

## ⚠️ Be Careful With
- Files in `packages/sdk/src/mcp/*/api.ts` (MCP APIs)
- Files with `Schema` in name
- `index.ts` files (barrel exports)
- When uncertain: KEEP THE EXPORT

## Success
```bash
$ bun knip
✔ No issues found!
```

## Progress Tracking
Update `KNIP_PROGRESS.md` after each batch.

---

**Read full details**: See `KNIP_CLEANUP_PROMPT.md`
**Check progress**: See `KNIP_PROGRESS.md`

START NOW: Run `bun knip` and begin with duplicate exports!


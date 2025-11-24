# Knip Cleanup Instructions - For Viktor

## Summary

I've created a comprehensive set of instructions and tools for a lighter/cheaper AI model (like Claude Sonnet 3.5 non-reasoning) to systematically clean up all knip errors.

## What Was Created

### 1. Main Prompt File
**File**: `KNIP_CLEANUP_PROMPT.md`
- **Purpose**: Complete prompt to copy-paste to an AI assistant
- **Contains**: Full mission brief, rules, examples, workflow loop
- **Use**: Copy the entire contents and paste as the initial prompt

### 2. Workspace Rules (Auto-applied)
**File**: `.cursor/rules/knip-cleanup.mdc`
- **Purpose**: Detailed rules for the AI to follow
- **Contains**: Safety checks, verification strategies, common patterns
- **Use**: This will be auto-applied when the AI works in this workspace

### 3. Quick Reference
**File**: `KNIP_QUICK_REF.md`  
- **Purpose**: Fast lookup card for commands and patterns
- **Contains**: Common fix patterns, commands, checklist
- **Use**: Reference during work, or include with each prompt

### 4. Progress Tracker
**File**: `KNIP_PROGRESS.md`
- **Purpose**: Track progress across context windows
- **Contains**: Checklist of all 282 exports to fix, verification log
- **Use**: AI updates this as it works, you can monitor progress

### 5. Summary Document
**File**: `.cursor/rules/knip-cleanup-summary.md`
- **Purpose**: High-level overview and strategy
- **Contains**: Phase breakdown, key principles, success criteria
- **Use**: Quick orientation for what needs to be done

## How to Use These Files

### Option 1: Single-Shot Prompt (Recommended Start)
1. Copy the entire contents of `KNIP_CLEANUP_PROMPT.md`
2. Paste into a chat with Claude Sonnet 3.5 (non-reasoning)
3. Let it run in loop mode
4. It will automatically:
   - Run `bun knip` to check errors
   - Fix files in batches
   - Verify with `bun check` periodically
   - Report progress
   - Loop until complete

### Option 2: Cursor Agent with Rules
1. The `.cursor/rules/knip-cleanup.mdc` file will be auto-applied
2. Simply tell the agent: "Fix all knip unused exports and duplicate exports"
3. Reference the progress tracker: "Check KNIP_PROGRESS.md"

### Option 3: Guided Multi-Session
If the AI needs multiple context windows:
1. Session 1: Fix duplicate exports (17 items)
2. Session 2: Fix apps/api unused exports
3. Session 3: Fix apps/mesh unused exports
4. Session 4: Fix apps/web unused exports (largest)
5. Session 5: Fix packages unused exports
6. Each session: Update `KNIP_PROGRESS.md`

## Current State

```bash
$ bun knip

Duplicate exports: 17
Unused exports: 282
Unused exported types: 265
```

## Strategy Created

### Phase 1: Duplicates (Priority)
Fix 17 duplicate exports first - these are the easiest:
- 3 API files (api.ts, app.ts, apps.ts)
- 11 React component files  
- 3 package schema files

### Phase 2: Unused Exports
Fix 282 unused exports systematically by directory:
1. apps/api/src/ (~11)
2. apps/outbound/ (~11)
3. apps/mesh/src/ (~10)
4. apps/web/src/ (~150+)
5. packages/ (~100)

## Key Safety Features Built In

✅ Always verify with grep before removing
✅ Run `bun knip` after every 5-10 edits
✅ Run `bun check` every 10-15 edits
✅ Special warnings for MCP APIs and auth files
✅ "When uncertain, keep it" principle
✅ Progress tracking across sessions

## Expected Outcome

When complete:
```bash
$ bun knip
✔ No issues found!
```

And `bun check` passes without new TypeScript errors.

## Estimated Effort

- **Duplicate exports**: ~30 minutes (easy fixes)
- **Unused exports**: ~2-4 hours (verification needed for each)
- **Total**: 2.5-4.5 hours of AI work

Given the loop-calling nature, a faster model (Sonnet 3.5) should be able to complete this in one long session or 2-3 shorter sessions.

## Testing the Setup

To verify the instructions work, you could:
1. Pick one duplicate export manually (e.g., `apps/api/src/api.ts`)
2. Follow the KNIP_CLEANUP_PROMPT.md instructions
3. Fix it manually to see if the approach makes sense
4. Then unleash the AI for the rest

## Notes

- The instructions specifically tell AI to IGNORE "Unused dependencies", "Unlisted dependencies" etc. (those might be knip config issues)
- Focus is ONLY on unused exports and duplicate exports
- Built-in verification at every step to prevent breaking the build
- Progress tracking so work can span multiple context windows if needed

## Files You Can Delete After Completion

Once `bun knip` shows no errors:
- `KNIP_CLEANUP_PROMPT.md`
- `KNIP_QUICK_REF.md`
- `KNIP_PROGRESS.md`
- `KNIP_CLEANUP_INSTRUCTIONS_FOR_VIKTOR.md` (this file)
- `.cursor/rules/knip-cleanup.mdc` (keep or remove as desired)
- `.cursor/rules/knip-cleanup-summary.md` (keep or remove as desired)

## Ready to Start?

Just copy `KNIP_CLEANUP_PROMPT.md` and paste it into your AI assistant!

Good luck! 🚀


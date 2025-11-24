# KNIP Cleanup Progress Tracker

**Mission Start Date**: [Date]
**Assigned To**: [AI Model Name]

---

## Initial State (Before Starting)
```
Run: bun knip

Duplicate exports: 17
Unused exports: 282
Unused exported types: 265
```

---

## Phase 1: Fix Duplicate Exports (PRIORITY)
**Target**: 17 duplicate exports → 0

### Batch 1.1 - API Files
- [ ] apps/api/src/api.ts - `app|default`
- [ ] apps/api/src/app.ts - `app|default`
- [ ] apps/api/src/apps.ts - `app|default`

**Status**: Not Started
**Result**: N/A

### Batch 1.2 - Web Components (Part 1)
- [ ] apps/web/src/components/agents/agents-resource-list.tsx
- [ ] apps/web/src/components/documents/documents-resource-list.tsx
- [ ] apps/web/src/components/onboarding/index.tsx
- [ ] apps/web/src/components/settings/channels.tsx
- [ ] apps/web/src/components/settings/general.tsx

**Status**: Not Started
**Result**: N/A

### Batch 1.3 - Web Components (Part 2)
- [ ] apps/web/src/components/settings/usage/usage.tsx
- [ ] apps/web/src/components/tools/tools-resource-list.tsx
- [ ] apps/web/src/components/triggers/trigger-details.tsx
- [ ] apps/web/src/components/views/view-detail.tsx
- [ ] apps/web/src/components/views/views-resource-list.tsx
- [ ] apps/web/src/components/workflows/workflows-resource-list.tsx

**Status**: Not Started
**Result**: N/A

### Batch 1.4 - Package Files
- [ ] packages/runtime/src/resources.ts - Multiple schema exports
- [ ] packages/sdk/src/models/trigger.ts - CronTriggerSchema duplicates
- [ ] packages/sdk/src/models/trigger.ts - WebhookTriggerSchema duplicates

**Status**: Not Started
**Result**: N/A

---

## Phase 2: Fix Unused Exports
**Target**: 282 unused exports → 0

### Section 2.1 - apps/api/src/
**Files**: ~11 unused exports

- [ ] api.ts - `app`
- [ ] app.ts - `APPS_DOMAIN_QS`, `app`
- [ ] apps.ts - `app`, `fetchScript`
- [ ] auth/index.ts - `createMagicLinkEmail`
- [ ] oauth/schema.ts - `OAUTH_TABLES`
- [ ] oauth/utils.ts - `hashPKCE`, `decodeOAuthState`
- [ ] utils/db.ts - `getCookieDomain`
- [ ] tail.ts - `default`

**Status**: Not Started
**Removed Count**: 0
**Remaining**: 11

### Section 2.2 - apps/outbound/
**Files**: ~11 unused exports

- [ ] jwt.ts - Multiple exports (alg, hash, stringifyJWK, parseJWK, etc.)

**Status**: Not Started
**Removed Count**: 0
**Remaining**: 11

### Section 2.3 - apps/mesh/src/
**Files**: ~10 unused exports

- [ ] api/index.ts - `app`
- [ ] auth/index.ts - `createApiKey`, `verifyApiKey`, `checkPermission`
- [ ] auth/sso.ts - `createMicrosoftSSO`
- [ ] core/context-factory.ts - `UnauthorizedError`, `NotFoundError`
- [ ] database/index.ts - `getDatabaseDialect`, `db`
- [ ] encryption/credential-vault.ts - `createVault`
- [ ] observability/index.ts - `standardMetrics`
- [ ] storage/test-helpers.ts - `dropTestSchema`
- [ ] tools/index.ts - `ConnectionTools`, `OrganizationTools`, `getTool`
- [ ] tools/registry.ts - `getToolMetadata`
- [ ] web/lib/locator.ts - `ORG_ADMIN_PROJECT_SLUG`

**Status**: Not Started
**Removed Count**: 0
**Remaining**: 10

### Section 2.4 - apps/web/src/components/
**Files**: ~150+ unused exports (LARGEST SECTION)

**Status**: Not Started
**Removed Count**: 0
**Remaining**: 150+

_Subdivide this section into smaller batches as you work through it_

### Section 2.5 - apps/web/src/ (non-components)
**Files**: ~20 unused exports

- [ ] constants.ts
- [ ] error-boundary.tsx
- [ ] hooks/*
- [ ] stores/*
- [ ] utils/*

**Status**: Not Started
**Removed Count**: 0
**Remaining**: 20

### Section 2.6 - packages/ai/src/
**Files**: ~15 unused exports

**Status**: Not Started
**Removed Count**: 0
**Remaining**: 15

### Section 2.7 - packages/cli/src/
**Files**: ~30 unused exports

**Status**: Not Started
**Removed Count**: 0
**Remaining**: 30

### Section 2.8 - packages/runtime/src/
**Files**: ~5 unused exports

**Status**: Not Started
**Removed Count**: 0
**Remaining**: 5

### Section 2.9 - packages/sdk/src/
**Files**: ~70 unused exports

**Status**: Not Started
**Removed Count**: 0
**Remaining**: 70

---

## Verification Log

### TypeScript Compilation Checks
| Check # | After Batch | Result | Errors | Fixed? |
|---------|-------------|--------|--------|--------|
| 1       | -           | -      | -      | -      |

### Knip Progress Checks
| Check # | After Batch | Duplicate | Unused | Notes |
|---------|-------------|-----------|--------|-------|
| 0       | Initial     | 17        | 282    | Starting point |

---

## Issues & Uncertainties

### Items Skipped (Uncertain if truly unused)
- None yet

### TypeScript Errors Encountered
- None yet

### Blocked Items
- None yet

---

## Completion Status

- [ ] Phase 1 Complete: All duplicate exports fixed (0/17)
- [ ] Phase 2 Complete: All unused exports fixed (0/282)
- [ ] Final verification: `bun knip` shows 0 errors
- [ ] Final check: `bun check` passes

**Completion Date**: Not Complete

---

## Instructions for AI

1. Update this file as you progress through each batch
2. Mark checkboxes with [x] when complete
3. Update counts and status fields
4. Log any uncertainties or issues
5. After each major section, update the verification logs
6. Keep this file updated so progress can be tracked across context windows

**Start by updating "Initial State" with actual `bun knip` output, then begin Phase 1.**


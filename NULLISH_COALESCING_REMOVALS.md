# Nullish Coalescing Removals on Spread Objects

This file enumerates all locations where nullish coalescing was removed from spread operations in the oxlint migration.

## ✅ Safe to Keep (No Action Needed)

### 1. apps/api/src/api.ts
**Lines: 475-476**

**Current:**
```typescript
headers: callerApp ? { "x-caller-app": callerApp } : {},
```

**Status:** OK - Correctly simplifies the header spread logic

---

### 2. apps/outbound/main.ts
**Lines: 96**

**Current:**
```typescript
...(req.body ? { body: req.body } : {}),
```

**Status:** OK - Proper fix since GET requests don't have a body

---

### 7. packages/ai/src/mcp.ts
**Lines: 50-52**

**Current:**
```typescript
headers: cookie ? { cookie } : {},
```

**Status:** OK - Conditional object property assignment (same pattern as #1)

---

## ⚠️ Changes to Undo

### 3. apps/web/src/components/agent/provider.tsx
**Lines: 223-224**

**Original (removed):**
```typescript
...(serverAgent.tools_set ?? {}),
...(additionalTools ?? {}),
```

**Current:**
```typescript
...serverAgent.tools_set,
...additionalTools,
```

---

### 4. apps/web/src/components/settings/usage/usage-stacked-bar-chart.tsx
**Line: 228**

**Original (removed):**
```typescript
...(data.additionalData ?? {}),
```

**Current:**
```typescript
...data.additionalData,
```

---

### 5. apps/web/src/utils/view-template.ts
**Line: 54**

**Original (removed):**
```typescript
...(importmap || {}),
```

**Current:**
```typescript
...importmap,
```

---

### 6. packages/ai/src/agent.ts
**Line: 621**

**Original (removed):**
```typescript
metadata: { ...(opts?.metadata ?? {}), timings },
```

**Current:**
```typescript
metadata: { ...(opts?.metadata as any), timings },
```

---

### 8. packages/cli/src/lib/prompt-ide-setup.ts
**Line: 69 (Cursor Config)**

**Original (removed):**
```typescript
...(existingConfig.mcpServers || {}),
```

**Current:**
```typescript
...existingConfig.mcpServers,
```

**Also at Line: 102 (VS Code Config)**

**Original (removed):**
```typescript
...(existingConfig.mcpServers || {}),
```

**Current:**
```typescript
...existingConfig.mcpServers,
```

---

### 9. packages/runtime/src/index.ts
**Line: 212**

**Original (removed):**
```typescript
...((user as User) ?? {}),
```

**Current:**
```typescript
...(user as User),
```

---

### 10. packages/runtime/src/mcp-client.ts
**Line: 86**

**Original (removed):**
```typescript
...(extraHeaders ?? {}),
```

**Current:**
```typescript
...extraHeaders,
```

---

### 11. packages/runtime/src/mcp.ts
**Line: 167**

**Original (removed):**
```typescript
...(options ?? {}),
```

**Current:**
```typescript
...options,
```

---

### 12. packages/sdk/src/actors/index.ts
**Lines: 23-24**

**Original (removed):**
```typescript
...(process?.env ?? {}),
...(env ?? {}),
```

**Current:**
```typescript
...process?.env,
...env,
```

---

### 13. packages/sdk/src/mcp/knowledge/api.ts
**Line: 141**

**Original (removed):**
```typescript
metadata: { ...(item.metadata ?? {}), content: item.content },
```

**Current:**
```typescript
metadata: { ...item.metadata, content: item.content },
```

---

### 14. packages/sdk/src/mcp/threads/api.ts
**Line: 333**

**Original (removed):**
```typescript
metadata: { ...(currentThread.metadata ?? {}), ...metadata },
```

**Current:**
```typescript
metadata: { ...currentThread.metadata, ...metadata },
```

---

### 15. packages/sdk/src/observability/samplers/debug.ts
**Line: 81**

**Original (removed):**
```typescript
...(sampleDecision.attributes ?? {}),
```

**Current:**
```typescript
...sampleDecision.attributes,
```

---

## Summary
- **Total that need undoing: 12 locations**
- **Safe to keep: 3 locations**
- **Pattern:** Conditional object property assignments (where you assign a conditional value directly to a property) can be simplified; spreads into parent objects need nullish coalescing
- **Files affected (need undo): 10**
  - `apps/web/src/components/agent/provider.tsx` (1)
  - `apps/web/src/components/settings/usage/usage-stacked-bar-chart.tsx` (1)
  - `apps/web/src/utils/view-template.ts` (1)
  - `packages/ai/src/agent.ts` (1)
  - `packages/cli/src/lib/prompt-ide-setup.ts` (2)
  - `packages/runtime/src/index.ts` (1)
  - `packages/runtime/src/mcp-client.ts` (1)
  - `packages/runtime/src/mcp.ts` (1)
  - `packages/sdk/src/actors/index.ts` (1)
  - `packages/sdk/src/mcp/knowledge/api.ts` (1)
  - `packages/sdk/src/mcp/threads/api.ts` (1)
  - `packages/sdk/src/observability/samplers/debug.ts` (1)

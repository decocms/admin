#!/usr/bin/env node
/**
 * Fetch tools from deployed worker MCP endpoint and print simplified list.
 * Usage:
 *   DECO_SELF_URL=https://your-worker.workers.dev node scripts/self-tools.mjs
 */

import { logSafe } from "@deco/workers-runtime/logSafe";
const base = process.env.DECO_SELF_URL || process.argv[2];
if (!base) {
  logSafe.error("[self-tools] missing DECO_SELF_URL or arg");
  process.exit(1);
}

const listUrl = base.replace(/\/$/, "") + "/mcp/tools";

try {
  const res = await fetch(listUrl);
  if (!res.ok) {
    logSafe.error("[self-tools] list tools failed", {
      status: res.status,
      body: await res.text(),
    });
    process.exit(1);
  }
  const json = await res.json();
  const simplified = (json.tools || []).map((t) => ({
    name: t.name,
    hasInput: !!t.inputSchema,
    hasOutput: !!t.outputSchema,
    description: t.description,
    inputKeys: Object.keys(t.inputSchema?.properties || {}),
    outputKeys: Object.keys(t.outputSchema?.properties || {}),
  }));
  logSafe.info("[self-tools] tools", { list: simplified });
} catch (e) {
  logSafe.error("[self-tools] fetch error", { error: e.message });
  process.exit(1);
}

#!/usr/bin/env node
/**
 * Fetch tools from deployed worker MCP endpoint and print simplified list.
 * Usage:
 *   DECO_SELF_URL=https://your-worker.workers.dev node scripts/self-tools.mjs
 */

const base = process.env.DECO_SELF_URL || process.argv[2];
if (!base) {
  console.error('Missing DECO_SELF_URL env or URL arg');
  process.exit(1);
}

const listUrl = base.replace(/\/$/, '') + '/mcp/tools';

try {
  const res = await fetch(listUrl);
  if (!res.ok) {
    console.error('Failed to list tools', res.status, await res.text());
    process.exit(1);
  }
  const json = await res.json();
  const simplified = (json.tools || []).map(t => ({
    name: t.name,
    hasInput: !!t.inputSchema,
    hasOutput: !!t.outputSchema,
    description: t.description,
    inputKeys: Object.keys(t.inputSchema?.properties || {}),
    outputKeys: Object.keys(t.outputSchema?.properties || {}),
  }));
  console.log(JSON.stringify(simplified, null, 2));
} catch (e) {
  console.error('Error fetching tools', e);
  process.exit(1);
}

/*
  Helper script: fetch tools list from deployed worker and print JSON (name + schemas).
  Usage:
    npx ts-node ./scripts/self-tools.ts "https://seo-ecommerce.ggstv-fer.workers.dev"
*/

// Allow running under ts-node without full type setup.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { logSafe } from '@deco/workers-runtime/logSafe';
async function main(base = process.argv[2]) {
  if (!base) {
    logSafe.error('[self-tools-ts] missing base URL argument');
    process.exit(1);
  }
  const listUrl = `${base.replace(/\/$/, '')}/mcp/tools`;
  const res = await fetch(listUrl);
  if (!res.ok) {
    logSafe.error('[self-tools-ts] list tools failed', {
      status: res.status,
      body: await res.text(),
    });
    process.exit(1);
  }
  const json = await res.json();
  // Expect shape { tools: [{name, inputSchema, outputSchema, description?}, ...] }
  const simplified = json.tools?.map((t: any) => ({
    name: t.name,
    description: t.description,
    inputKeys: Object.keys(t.inputSchema?.properties || {}),
    outputKeys: Object.keys(t.outputSchema?.properties || {}),
  }));
  logSafe.info('[self-tools-ts] tools', { list: simplified });
}

main();

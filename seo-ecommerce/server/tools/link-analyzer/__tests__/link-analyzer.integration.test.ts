import { describe, it, expect } from 'vitest';

const selfUrl = process.env.DECO_SELF_URL;

// Only runs if DECO_SELF_URL is defined (e.g., pointing to deployed workers.dev)
// Use: DECO_SELF_URL=https://your-worker.workers.dev npm run test
// Otherwise the suite is skipped to keep CI green locally.
(selfUrl ? describe : describe.skip)('LINK_ANALYZER integration (MCP HTTP)', () => {
  it('calls the tool via /mcp/call-tool/LINK_ANALYZER', async () => {
    const res = await fetch(`${selfUrl}/mcp/call-tool/LINK_ANALYZER`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    });
    expect(res.ok).toBe(true);
    const json = await res.json();
    expect(json.structuredContent).toBeTruthy();
    expect(typeof json.structuredContent.linksFound).toBe('number');
  });
});

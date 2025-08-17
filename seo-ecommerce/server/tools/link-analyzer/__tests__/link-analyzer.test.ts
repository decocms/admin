import { describe, it, expect } from 'vitest';
import { analyzeLinks } from '../analyze';

describe('analyzeLinks basic structure', () => {
  it('resolves with expected shape (no network guarantee on metrics)', async () => {
    const result = await analyzeLinks('https://example.com');
    expect(result).toHaveProperty('linksFound');
    expect(result).toHaveProperty('brokenLinks');
    expect(result).toHaveProperty('seoScore');
    expect(typeof result.seoScore).toBe('number');
  }, 20000);
});

// Integration test of tool factory skipped due to Vitest parser issues with
// 'using' declarations inside the full workers-runtime dependency chain.
// TODO: Add an integration/e2e test invoking the MCP HTTP endpoint once
// remote wrangler dev environment is stable on this macOS version.

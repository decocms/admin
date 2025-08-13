import { describe, it, expect } from 'vitest';
import { analyzeLinks } from '../analyze';

describe('analyzeLinks pure function', () => {
  it('returns deterministic mocked metrics', () => {
    const result = analyzeLinks('https://example.com');
    expect(result.linksFound).toBe(42);
    expect(result.brokenLinks).toBe(3);
    expect(result.seoScore).toBe(85);
  });
});

// Integration test of tool factory skipped due to Vitest parser issues with
// 'using' declarations inside the full workers-runtime dependency chain.
// TODO: Add an integration/e2e test invoking the MCP HTTP endpoint once
// remote wrangler dev environment is stable on this macOS version.

import { describe, it, expect } from 'vitest';
import { createAiInsightsTool } from '../../ai-insights';

// Mock fetch to simulate LLM failure
function withPatchedFetch(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>, fn: () => Promise<void>) {
  const orig = (globalThis as any).fetch;
  (globalThis as any).fetch = impl;
  return fn().finally(() => { (globalThis as any).fetch = orig; });
}

describe('AI_INSIGHTS LLM fallback on error', () => {
  it('falls back to heuristics when LLM request fails', async () => {
    const audit = {
      url: 'https://example.com',
      scores: { performanceMobile: 40, seoMobile: 60 },
      linkSummary: { brokenLinks: 1, imagesMissingAlt: 2, h1Count: 2, titleLength: 70, metaDescriptionLength: 40, wordCount: 250 },
      warnings: ['Broken links detectados: 1']
    };
    await withPatchedFetch(async () => new Response('fail', { status: 500 }), async () => {
      const tool = createAiInsightsTool({ OPENROUTER_API_KEY: 'dummy' });
      const out = await tool.execute({ context: { url: audit.url, audit } } as any);
      expect(out.modelUsed).toBe('heuristic');
      expect(out.insights.length).toBeGreaterThan(0);
      expect(out.warnings.join(' ')).toMatch(/Fallback heurístico/);
    });
  });
});

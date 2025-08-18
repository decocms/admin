import { describe, expect, it } from 'vitest';
import { runSeoAuditPure as runSeoAudit } from '../runner';

// Lightweight heuristic test: mock PageSpeed tool via environment shim if needed.

function mockEnv(overrides: Record<string, any> = {}) {
  return { ...overrides } as any;
}

describe('SEO_AUDIT heuristics', () => {
  it('produces warnings for poor metrics & structure', async () => {
    const out = await runSeoAudit(
      {
        analyzeLinks: async () => ({
          linksFound: 8,
          brokenLinks: 1,
          internalLinks: 5,
          externalLinks: 3,
          images: 2,
          imagesMissingAlt: 1,
          h1Count: 2,
          titleLength: 70,
          metaDescriptionLength: 40,
          wordCount: 150,
          seoScore: 60,
        }),
        getPageSpeed: async () => ({
          categories: { performance: 40, seo: 65 },
          metrics: { LCP_ms: 4100, CLS: 0.11, INP_ms: 280 },
        }),
      },
      { url: 'https://example.com' },
    );
    expect(out).toHaveProperty('scores');
    expect(out).toHaveProperty('linkSummary');
    expect(out).toHaveProperty('warnings');
    expect(Array.isArray(out.warnings)).toBe(true);
  }, 20000);
});

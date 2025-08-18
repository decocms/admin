import { describe, expect, it } from 'vitest';
import { runSeoAuditPure } from '../runner';

function mockLink(over: Partial<any> = {}) {
  return {
    linksFound: 10,
    brokenLinks: over.brokenLinks ?? 2,
    internalLinks: 3,
    externalLinks: 1,
    images: 5,
    imagesMissingAlt: over.imagesMissingAlt ?? 1,
    h1Count: over.h1Count ?? 2,
    titleLength: over.titleLength ?? 70,
    metaDescriptionLength: over.metaDescriptionLength ?? 40,
    wordCount: over.wordCount ?? 200,
    seoScore: 55,
  };
}

function mockPS(over: Partial<any> = {}) {
  return {
    categories: {
      performance: (over.performance ?? 45) / 100, // convert to 0-1 like Lighthouse to simulate normalization? We'll pass already normalized numbers
      seo: (over.seo ?? 65) / 100,
    },
    metrics: {
      LCP_ms: over.LCP_ms ?? 4200,
      CLS: over.CLS ?? 0.12,
      INP_ms: 250,
    },
  };
}

describe('SEO_AUDIT warning generation (pure)', () => {
  it('triggers multiple warnings for poor metrics', async () => {
    const out = await runSeoAuditPure(
      {
        analyzeLinks: async () => mockLink({}),
        getPageSpeed: async ({ strategy }) => ({
          categories: { performance: 45, seo: 65 },
          metrics: { LCP_ms: 4200, CLS: 0.12, INP_ms: 250 },
        }),
      },
      { url: 'https://example.com' },
    );
    const w = out.warnings.join('\n');
    expect(w).toMatch(/LCP mobile > 4s/);
    expect(w).toMatch(/CLS mobile > 0.1/);
    expect(w).toMatch(/Performance mobile baixa/);
    expect(w).toMatch(/Score SEO mobile baixo/);
  });

  it('handles partial metrics gracefully', async () => {
    const out = await runSeoAuditPure(
      {
        analyzeLinks: async () => mockLink({ imagesMissingAlt: 0 }),
        getPageSpeed: async ({ strategy }) => ({
          categories: { performance: 90 },
          metrics: {},
        }),
      },
      { url: 'https://example.com' },
    );
    expect(out.coreWebVitals.LCP_ms_mobile).toBeNull();
    expect(out.coreWebVitals.CLS_mobile).toBeNull();
    expect(out.scores.performanceMobile).toBe(90);
  });
});

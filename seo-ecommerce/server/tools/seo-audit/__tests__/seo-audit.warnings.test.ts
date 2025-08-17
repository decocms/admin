import { describe, it, expect } from 'vitest';
import { createSeoAuditTool } from '../../seo-audit';

// We'll monkey patch dependencies by injecting a fake env with overrides if tool reads them later (currently not used).
// Instead, we simulate the internal functions by temporarily replacing global fetch for PageSpeed calls.

function withPatchedFetch(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>, fn: () => Promise<void>) {
  const orig = (globalThis as any).fetch;
  (globalThis as any).fetch = impl;
  return fn().finally(() => { (globalThis as any).fetch = orig; });
}

const makePSI = (over: Partial<any>) => ({
  lighthouseResult: {
    categories: {
      performance: { score: (over.performanceScore ?? 0.45) },
      seo: { score: (over.seoScore ?? 0.65) },
    },
    audits: {
      'largest-contentful-paint': { numericValue: over.LCP_ms ?? 4200 },
      'cumulative-layout-shift': { numericValue: over.CLS ?? 0.12 },
      'interaction-to-next-paint': { numericValue: 250 },
      'first-contentful-paint': { numericValue: 1200 },
      'total-blocking-time': { numericValue: 300 },
      // Add an opportunity audit to test mapping (not directly warning-related here)
      'unused-css-rules': { id: 'unused-css-rules', title: 'Remove unused CSS', score: 0.5, details: { type: 'opportunity', overallSavingsMs: 1500 } }
    },
  },
  id: 'https://example.com',
});

// Fake link analyzer import side-effect; we cannot easily patch analyzeLinks here without changing tool code.
// We'll simulate a scenario by letting real analyzeLinks run for example.com (fast) and accept variability.

describe('SEO_AUDIT warning generation', () => {
  it('triggers multiple warnings for poor metrics', async () => {
    await withPatchedFetch(async () => new Response(JSON.stringify(makePSI({})), { status: 200 }), async () => {
      const tool = createSeoAuditTool({});
      const out = await tool.execute({ context: { url: 'https://example.com' } } as any);
      // Expect presence of key warnings based on our injected scores
      const w = out.warnings.join('\n');
      expect(w).toMatch(/LCP mobile > 4s/);
      expect(w).toMatch(/CLS mobile > 0.1/);
      expect(w).toMatch(/Performance mobile baixa/);
      expect(w).toMatch(/Score SEO mobile baixo/);
    });
  }, 15000);

  it('gracefully handles partial PageSpeed (missing audits)', async () => {
    const partial = { lighthouseResult: { categories: { performance: { score: 0.9 } }, audits: {} }, id: 'https://example.com' };
    await withPatchedFetch(async () => new Response(JSON.stringify(partial), { status: 200 }), async () => {
      const tool = createSeoAuditTool({});
      const out = await tool.execute({ context: { url: 'https://example.com' } } as any);
      expect(out.coreWebVitals.LCP_ms_mobile).toBeNull();
      expect(out.coreWebVitals.CLS_mobile).toBeNull();
      expect(out.scores.performanceMobile).toBe(90);
    });
  }, 10000);
});

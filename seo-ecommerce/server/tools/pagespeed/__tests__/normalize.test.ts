import { describe, it, expect } from 'vitest';
import { normalizePageSpeedPure as normalizePageSpeed } from '../normalize';

const sample = {
  id: 'https://example.com',
  lighthouseResult: {
    requestedUrl: 'https://example.com',
    lighthouseVersion: '11.0.0',
    categories: {
      performance: { score: 0.91 },
      accessibility: { score: 0.8 },
      seo: { score: 0.92 },
    },
    audits: {
      'first-contentful-paint': { numericValue: 1234 },
      'largest-contentful-paint': { numericValue: 2456 },
      'cumulative-layout-shift': { numericValue: 0.04 },
      'total-blocking-time': { numericValue: 110 },
      'interaction-to-next-paint': { numericValue: 320 },
      'unused-css-rules': { id: 'unused-css-rules', title: 'Unused CSS', details: { type: 'opportunity', overallSavingsMs: 150 }, score: 0.5 },
    }
  }
};

describe('normalizePageSpeed', () => {
  it('maps scores & metrics correctly', () => {
    const out = normalizePageSpeed(sample, 'https://fallback.test', 'mobile');
    expect(out.categories.performance).toBe(91);
    expect(out.metrics.LCP_ms).toBe(2456);
    expect(out.opportunities?.length).toBe(1);
    expect(out.opportunities?.[0].id).toBe('unused-css-rules');
  });

  it('handles missing fields gracefully', () => {
    const minimal = {} as any;
    const out = normalizePageSpeed(minimal, 'https://fb', 'desktop');
    expect(out.categories.performance).toBeNull();
    expect(out.metrics.LCP_ms).toBeNull();
  });
});

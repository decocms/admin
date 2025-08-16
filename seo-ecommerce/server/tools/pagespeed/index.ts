import { z } from 'zod';
import { createTool } from '@deco/workers-runtime/mastra';

// Simple in-memory cache (per worker instance) to avoid hammering the public API.
const cache = new Map<string, { ts: number; data: any }>();
const TTL_MS = 10 * 60 * 1000; // 10 minutes

const InputSchema = z.object({
  url: z.string().url(),
  strategy: z.enum(['mobile','desktop']).default('mobile'),
  category: z.array(z.enum(['performance','accessibility','seo','pwa'])).default(['performance','seo']),
});

// Normalized output focusing on key core web vitals + category scores
const OutputSchema = z.object({
  fetchedUrl: z.string().url(),
  strategy: z.string(),
  lighthouseVersion: z.string().optional(),
  categories: z.object({
    performance: z.number().nullable().optional(),
    accessibility: z.number().nullable().optional(),
    seo: z.number().nullable().optional(),
    pwa: z.number().nullable().optional(),
  }),
  metrics: z.object({
    FCP_ms: z.number().nullable().optional(),
    LCP_ms: z.number().nullable().optional(),
    CLS: z.number().nullable().optional(),
    TBT_ms: z.number().nullable().optional(),
    INP_ms: z.number().nullable().optional(),
  }),
  opportunities: z.array(z.object({ id: z.string(), title: z.string(), score: z.number().nullable().optional(), savingsMs: z.number().nullable().optional() })).optional(),
  fetchedAt: z.string(),
  cache: z.boolean().default(false),
});

export const createPageSpeedTool = (_env: Record<string, unknown>) => createTool({
  id: 'PAGESPEED',
  description: 'Fetches Google PageSpeed Insights (Lighthouse) summary for a URL',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  execute: async ({ context }) => {
    const { url, strategy, category } = context;
    const key = JSON.stringify({ u: url, s: strategy, c: category });
    const now = Date.now();
    const cached = cache.get(key);
    if (cached && now - cached.ts < TTL_MS) {
      return { ...cached.data, cache: true };
    }
    const params = new URLSearchParams({ url, strategy });
    if (category && category.length) category.forEach(c => params.append('category', c));
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`;
    const res = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) {
      throw new Error(`PageSpeed API ${res.status}`);
    }
    const json = await res.json();
    const lh = json.lighthouseResult || {};
    const cats = lh.categories || {};
    const audits = lh.audits || {};
    const norm = {
      fetchedUrl: json.id || lh.requestedUrl || url,
      strategy,
      lighthouseVersion: lh.lighthouseVersion,
      categories: {
        performance: cats.performance ? cats.performance.score * 100 : null,
        accessibility: cats.accessibility ? cats.accessibility.score * 100 : null,
        seo: cats.seo ? cats.seo.score * 100 : null,
        pwa: cats.pwa ? cats.pwa.score * 100 : null,
      },
      metrics: {
        FCP_ms: audits['first-contentful-paint']?.numericValue ?? null,
        LCP_ms: audits['largest-contentful-paint']?.numericValue ?? null,
        CLS: audits['cumulative-layout-shift']?.numericValue ?? null,
        TBT_ms: audits['total-blocking-time']?.numericValue ?? null,
        INP_ms: audits['interaction-to-next-paint']?.numericValue ?? null,
      },
      opportunities: Object.values(audits)
        .filter((a: any) => a?.details?.type === 'opportunity')
        .slice(0, 8)
        .map((a: any) => ({
          id: a.id,
          title: a.title,
            score: typeof a.score === 'number' ? a.score : null,
          savingsMs: a?.details?.overallSavingsMs ?? null,
        })),
      fetchedAt: new Date().toISOString(),
      cache: false,
    };
    cache.set(key, { ts: now, data: norm });
    return norm;
  }
});

export type PageSpeedInput = z.infer<typeof InputSchema>;
export type PageSpeedOutput = z.infer<typeof OutputSchema>;

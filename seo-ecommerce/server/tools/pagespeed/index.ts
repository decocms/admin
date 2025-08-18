import { z } from 'zod';
import { createTool } from '@deco/workers-runtime/mastra';
import { buildPageSpeedKey, type CacheLayerEnv, getOrSet } from '../cache';
import { getCacheConfig } from '../../config/cache';
import { recordToolError, recordToolSuccess } from '../metrics';

const InputSchema = z.object({
  url: z.string().url(),
  strategy: z.enum(['mobile', 'desktop']).default('mobile'),
  category: z
    .array(z.enum(['performance', 'accessibility', 'seo', 'pwa']))
    .default(['performance', 'seo']),
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
  opportunities: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        score: z.number().nullable().optional(),
        savingsMs: z.number().nullable().optional(),
      }),
    )
    .optional(),
  fetchedAt: z.string(),
  cache: z.boolean().default(false),
});

export const createPageSpeedTool = (
  env: CacheLayerEnv & Record<string, unknown>,
) =>
  createTool({
    id: 'PAGESPEED',
    description: 'Fetches Google PageSpeed Insights (Lighthouse) summary for a URL',
    inputSchema: InputSchema,
    outputSchema: OutputSchema,
    execute: async ({ context }) => {
      const start = Date.now();
      const { url, strategy, category } = context;
      try {
        const cfg = getCacheConfig('pagespeed');
        const key = buildPageSpeedKey(url, strategy);
        const bypass = (context as any)?.noCache === true;
        const res = await getOrSet(
          env,
          key,
          async () => {
            const params = new URLSearchParams({ url, strategy });
            if (category && category.length) {
              category.forEach((c) => params.append('category', c));
            }
            const apiUrl =
              `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`;
            const resp = await fetch(apiUrl, {
              headers: { Accept: 'application/json' },
            });
            if (!resp.ok) throw new Error(`PageSpeed API ${resp.status}`);
            const json = await resp.json();
            return normalizePageSpeed(json, url, strategy);
          },
          {
            ttlSeconds: cfg.fresh,
            staleTtlSeconds: cfg.stale,
            hardTtlSeconds: cfg.hard,
            version: cfg.version,
            bypass,
          },
        );
        recordToolSuccess('PAGESPEED', Date.now() - start);
        return { ...res.data, cache: res.cache, stale: res.stale };
      } catch (e) {
        recordToolError('PAGESPEED', Date.now() - start);
        throw e;
      }
    },
  });

// Pure normalization helper (exported for tests)
export function normalizePageSpeed(
  json: any,
  fallbackUrl: string,
  strategy: string,
) {
  const lh = json?.lighthouseResult || {};
  const cats = lh.categories || {};
  const audits = lh.audits || {};
  return {
    fetchedUrl: json?.id || lh.requestedUrl || fallbackUrl,
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
}

export type PageSpeedInput = z.infer<typeof InputSchema>;
export type PageSpeedOutput = z.infer<typeof OutputSchema>;

export function normalizePageSpeedPure(json: any, fallbackUrl: string, strategy: string) {
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
      .map((a: any) => ({ id: a.id, title: a.title, score: typeof a.score === 'number' ? a.score : null, savingsMs: a?.details?.overallSavingsMs ?? null })),
    fetchedAt: new Date().toISOString(),
    cache: false,
  };
}

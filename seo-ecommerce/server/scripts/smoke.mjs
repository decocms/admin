#!/usr/bin/env node
/**
 * Local smoke test for the seo-ecommerce worker.
 * Assumes `npm run dev` is running (view + server) so the worker listens on localhost:8787.
 * You can override BASE_URL env var.
 */
const BASE = process.env.BASE_URL || 'http://localhost:8787';
const MAX_WAIT_MS = parseInt(process.env.SMOKE_WAIT_MS || '30000', 10); // total wait up to 30s by default
const WAIT_INTERVAL_MS = 1000;

import { logSafe } from '@deco/workers-runtime/logSafe';
function log(title, data, ok = true) {
  if (ok) logSafe.info(`[smoke] ${title}`, { data });
  else {
    logSafe.error(`[smoke] ${title}`, {
      error: data?.message || String(data),
    });
  }
}

async function safeFetch(url, opts) {
  const res = await fetch(url, opts).catch((e) => ({ error: e }));
  if (res.error) throw res.error;
  const ct = res.headers.get('content-type') || '';
  let body;
  if (ct.includes('application/json')) body = await res.json();
  else body = await res.text();
  return { status: res.status, body, headers: Object.fromEntries(res.headers) };
}

async function waitForReady() {
  const start = Date.now();
  while (Date.now() - start < MAX_WAIT_MS) {
    try {
      const r = await fetch(`${BASE}/__env`, { method: 'GET' });
      if (r.ok) return true;
    } catch (e) {
      // ignore until timeout
    }
    await new Promise((r) => setTimeout(r, WAIT_INTERVAL_MS));
  }
  return false;
}

async function run() {
  const ready = await waitForReady();
  if (!ready) {
    logSafe.error('[smoke] worker not reachable', {
      base: BASE,
      maxWaitMs: MAX_WAIT_MS,
    });
    process.exit(1);
  }
  const summary = { tools: {}, timings: {} };
  const startAll = Date.now();
  // 1. __env
  await step('__env', async () => {
    const t0 = Date.now();
    const r = await safeFetch(`${BASE}/__env`);
    summary.timings.__env = Date.now() - t0;
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    return r.body;
  });
  // 2. list tools
  await step('list tools', async () => {
    const t0 = Date.now();
    const r = await safeFetch(`${BASE}/mcp/tools`);
    summary.timings.list = Date.now() - t0;
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    const names = (r.body.tools || []).map((t) => t.name);
    summary.tools.listed = names;
    if (!names.includes('LINK_ANALYZER')) {
      throw new Error('LINK_ANALYZER missing');
    }
    if (!names.includes('PAGESPEED')) throw new Error('PAGESPEED missing');
    return names;
  });
  // 3. LINK_ANALYZER
  const testUrl = 'https://example.com';
  await step('LINK_ANALYZER', async () => {
    const t0 = Date.now();
    const r = await safeFetch(`${BASE}/mcp/tools`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tool: 'LINK_ANALYZER', input: { url: testUrl } }),
    });
    summary.timings.link = Date.now() - t0;
    if (r.status !== 200) {
      throw new Error(`Status ${r.status}: ${JSON.stringify(r.body)}`);
    }
    const c = r.body.result || r.body;
    summary.tools.LINK_ANALYZER = {
      linkCount: Array.isArray(c.links) ? c.links.length : 0,
    };
    return summary.tools.LINK_ANALYZER;
  });
  // 4. PAGESPEED mobile
  await step('PAGESPEED mobile', async () => {
    const t0 = Date.now();
    const r = await safeFetch(`${BASE}/mcp/tools`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tool: 'PAGESPEED',
        input: {
          url: testUrl,
          strategy: 'mobile',
          category: ['performance', 'seo'],
        },
      }),
    });
    summary.timings.psMobile = Date.now() - t0;
    if (r.status !== 200) {
      throw new Error(`Status ${r.status}: ${JSON.stringify(r.body)}`);
    }
    const out = r.body.result || r.body;
    summary.tools.PAGESPEED_mobile = {
      perf: out.categories?.performance,
      seo: out.categories?.seo,
      LCP_ms: out.metrics?.LCP_ms,
    };
    return summary.tools.PAGESPEED_mobile;
  });
  // 5. PAGESPEED desktop
  await step('PAGESPEED desktop', async () => {
    const t0 = Date.now();
    const r = await safeFetch(`${BASE}/mcp/tools`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tool: 'PAGESPEED',
        input: {
          url: testUrl,
          strategy: 'desktop',
          category: ['performance', 'seo'],
        },
      }),
    });
    summary.timings.psDesktop = Date.now() - t0;
    if (r.status !== 200) {
      throw new Error(`Status ${r.status}: ${JSON.stringify(r.body)}`);
    }
    const out = r.body.result || r.body;
    summary.tools.PAGESPEED_desktop = {
      perf: out.categories?.performance,
      seo: out.categories?.seo,
      LCP_ms: out.metrics?.LCP_ms,
    };
    return summary.tools.PAGESPEED_desktop;
  });
  // 6. Direct /api/analisar endpoint
  await step('/api/analisar', async () => {
    const t0 = Date.now();
    const r = await safeFetch(`${BASE}/api/analisar`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: testUrl }),
    });
    summary.timings.directAnalyze = Date.now() - t0;
    if (r.status !== 200) {
      throw new Error(`Status ${r.status}: ${JSON.stringify(r.body)}`);
    }
    return { status: r.status };
  });

  // 7. SEO_AUDIT composite
  await step('SEO_AUDIT', async () => {
    const t0 = Date.now();
    const r = await safeFetch(`${BASE}/mcp/tools`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tool: 'SEO_AUDIT', input: { url: testUrl } }),
    });
    summary.timings.seoAudit = Date.now() - t0;
    if (r.status !== 200) {
      throw new Error(`Status ${r.status}: ${JSON.stringify(r.body)}`);
    }
    const out = r.body.result || r.body;
    summary.tools.SEO_AUDIT = {
      perfMobile: out.scores?.performanceMobile,
      seoMobile: out.scores?.seoMobile,
      linkSeo: out.scores?.linkSeoScore,
      warnings: (out.warnings || []).length,
    };
    return summary.tools.SEO_AUDIT;
  });

  // 8. AI_INSIGHTS (heuristic or LLM)
  await step('AI_INSIGHTS', async () => {
    const t0 = Date.now();
    const r = await safeFetch(`${BASE}/mcp/tools`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tool: 'AI_INSIGHTS', input: { url: testUrl } }),
    });
    summary.timings.aiInsights = Date.now() - t0;
    if (r.status !== 200) {
      throw new Error(`Status ${r.status}: ${JSON.stringify(r.body)}`);
    }
    const out = r.body.result || r.body;
    summary.tools.AI_INSIGHTS = {
      insights: (out.insights || []).length,
      model: out.modelUsed,
    };
    return summary.tools.AI_INSIGHTS;
  });

  const totalMs = Date.now() - startAll;
  logSafe.info('[smoke] summary', { totalMs, ...summary });
  const warn = [];
  const mob = summary.tools.PAGESPEED_mobile || {};
  if (mob.perf && mob.perf < 60) warn.push('Mobile performance < 60');
  if (mob.LCP_ms && mob.LCP_ms > 4000) warn.push('Mobile LCP > 4000ms');
  if (warn.length) logSafe.warn('[smoke] warnings', { warn });
  process.exit(0);
}

async function step(name, fn) {
  try {
    const res = await fn();
    log(name, res, true);
  } catch (e) {
    log(name, e, false);
    process.exitCode = 1;
    throw e; // stop further tests
  }
}

run().catch((e) => {
  logSafe.error('[smoke] failed', { error: e.message });
  process.exit(1);
});

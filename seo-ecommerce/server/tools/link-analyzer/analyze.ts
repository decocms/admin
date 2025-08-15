// Fallback fetch for Node.js (local dev)
let localFetch: typeof fetch = globalThis.fetch;
try {
  if (typeof fetch === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    localFetch = require('node-fetch');
  }
} catch {}
// Pure analysis logic kept separate so unit tests avoid importing workers runtime.
export interface LinkAnalysisResult {
  url: string;
  status: number;
  linksFound: number;
  brokenLinks: number;
  internalLinks: number;
  externalLinks: number;
  images: number;
  imagesMissingAlt: number;
  h1Count: number;
  title?: string;
  titleLength: number;
  metaDescription?: string;
  metaDescriptionLength: number;
  wordCount: number;
  canonical?: string;
  seoScore: number;
  links: string[];
  notes?: string;
}

// Basic HTML anchor extraction (regex-based; sufficient for simple pages)
function extractLinks(html: string, base: URL): string[] {
  const links = new Set<string>();
  const re = /<a\b[^>]*href=["']([^"'#]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = m[1].trim();
    if (!raw || raw.startsWith('mailto:') || raw.startsWith('javascript:')) continue;
    try {
      const abs = new URL(raw, base).toString();
      links.add(abs);
    } catch { /* ignore invalid URL */ }
    if (links.size >= 500) break; // cap
  }
  return Array.from(links);
}

async function headOrGet(url: string, timeoutMs: number): Promise<number> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await localFetch(url, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal });
    if (res.status === 405 || res.status === 501) {
      // Some servers disallow HEAD
      const resGet = await localFetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal });
      return resGet.status;
    }
    return res.status;
  } catch {
    return 0; // treat 0 as network failure
  } finally {
    clearTimeout(t);
  }
}

export async function analyzeLinks(url: string): Promise<LinkAnalysisResult> {
  const start = Date.now();
  let html = '';
  let fetchOk = false;
  let status = 0;
  let notes: string[] = [];
  try {
  const res = await localFetch(url, { method: 'GET', redirect: 'follow', headers: { 'User-Agent': 'DecoLinkAnalyzer/1.0 (+https://seo-ecommercex.deco.page/)' } });
    status = res.status;
    if (!res.ok) {
      notes.push(`Fetch status ${res.status}`);
    } else {
      // Cap html size to 500KB to avoid excessive memory/time
      const buf = await res.arrayBuffer();
      const slice = buf.byteLength > 512 * 1024 ? buf.slice(0, 512 * 1024) : buf;
      html = new TextDecoder('utf-8').decode(slice);
      if (buf.byteLength > slice.byteLength) notes.push('HTML truncado a 500KB');
      fetchOk = true;
    }
  } catch (e) {
    const err = e as Error;
    notes.push(`Falha no fetch principal: ${err.message}`);
  }
  const base = new URL(url);
  const links = fetchOk ? extractLinks(html, base) : [];
  // Internal vs external
  const origin = base.origin;
  let internalLinks = 0; let externalLinks = 0;
  links.forEach(l => { if (l.startsWith(origin)) internalLinks++; else externalLinks++; });

  // Extract basic metadata (simple regex parsing to keep bundle light)
  let title='';
  const titleMatch = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  if (titleMatch) title = titleMatch[1].trim();
  let metaDescription='';
  const metaDescMatch = /<meta[^>]*name=["']description["'][^>]*>/i.exec(html);
  if (metaDescMatch) {
    const attrMatch = /content=["']([^"']*)["']/i.exec(metaDescMatch[0]);
    if (attrMatch) metaDescription = attrMatch[1].trim();
  }
  // Canonical
  let canonical='';
  const canonicalMatch = /<link[^>]*rel=["']canonical["'][^>]*>/i.exec(html);
  if (canonicalMatch) {
    const hrefMatch = /href=["']([^"']+)["']/i.exec(canonicalMatch[0]);
    if (hrefMatch) {
      try { canonical = new URL(hrefMatch[1], base).toString(); } catch {}
    }
  }
  // H1 count
  const h1Count = (html.match(/<h1\b/gi) || []).length;
  // Word count (strip tags, collapse whitespace)
  let wordCount = 0;
  if (html) {
    const text = html.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ');
    wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  }
  // Images & missing alt
  let images = 0; let imagesMissingAlt = 0;
  const imgRe = /<img\b[^>]*>/gi;
  let imgMatch: RegExpExecArray|null;
  while ((imgMatch = imgRe.exec(html))) {
    images++;
    const tag = imgMatch[0];
    if (!/alt=\s*["'][^"']*["']/i.test(tag)) imagesMissingAlt++;
    if (images >= 500) break; // cap
  }
  const sample = links.slice(0, 40); // limit link checking to 40 to stay within worker limits/time
  let broken = 0;
  // Sequential to avoid blowing subrequest limits; could be parallel with Promise.allSettled and chunking.
  for (const l of sample) {
    const status = await headOrGet(l, 6000);
    if (status === 0 || status >= 400) broken++;
  }
  // Heuristic scoring
  let score = 100;
  if (!title) { score -= 10; notes.push('Sem <title>'); }
  if (title.length < 15 || title.length > 65) score -= 5;
  if (!metaDescription) { score -= 8; notes.push('Sem meta description'); }
  else if (metaDescription.length < 50 || metaDescription.length > 165) score -= 4;
  if (h1Count === 0) { score -= 6; notes.push('Sem H1'); }
  else if (h1Count > 2) { score -= 4; notes.push('H1s excessivos'); }
  if (imagesMissingAlt > 0) score -= Math.min(10, imagesMissingAlt);
  if (broken > 0) score -= Math.min(20, broken * 2);
  if (wordCount < 200) score -= 6;
  if (internalLinks < 3) score -= 3;
  if (externalLinks === 0) score -= 2;
  if (links.length > 300) score -= 5;
  const seoScore = Math.max(0, Math.min(100, score));
  if (!fetchOk) {
    // Fallback deterministic stub if we could not fetch
    if (!links.length) {
      return {
        url,
        status,
        linksFound: 0,
        brokenLinks: 0,
        internalLinks: 0,
        externalLinks: 0,
        images: 0,
        imagesMissingAlt: 0,
        h1Count: 0,
        title: undefined,
        titleLength: 0,
        metaDescription: undefined,
        metaDescriptionLength: 0,
        wordCount: 0,
        canonical: undefined,
        seoScore: 50,
        links: [],
        notes: notes.concat('Retorno parcial (stub, fetch falhou)').join('; '),
      };
    }
  }
  if (Date.now() - start > 15000) notes.push('Análise demorou >15s (parcial)');
  return {
    url,
    status,
    linksFound: links.length,
    brokenLinks: broken,
    internalLinks,
    externalLinks,
    images,
    imagesMissingAlt,
    h1Count,
    title: title || undefined,
    titleLength: title.length,
    metaDescription: metaDescription || undefined,
    metaDescriptionLength: metaDescription.length,
    wordCount,
    canonical: canonical || undefined,
    seoScore,
    links,
    notes: notes.length ? notes.join('; ') : undefined,
  };
}

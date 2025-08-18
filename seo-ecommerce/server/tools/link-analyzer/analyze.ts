// Fallback fetch for Node.js (local dev)
let localFetch: typeof fetch = globalThis.fetch;
try {
  if (typeof fetch === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    localFetch = require('node-fetch');
  }
} catch {}

import { parseHtml } from './parser';

// Public result interface
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

async function headOrGet(url: string, timeoutMs: number): Promise<number> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await localFetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: ctrl.signal,
    });
    if (res.status === 405 || res.status === 501) {
      // Some servers disallow HEAD
      const resGet = await localFetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: ctrl.signal,
      });
      return resGet.status;
    }
    return res.status;
  } catch {
    return 0; // treat 0 as network failure
  } finally {
    clearTimeout(t);
  }
}

const APP_ORIGIN = (typeof process !== 'undefined' &&
  process.env &&
  (process.env.PUBLIC_APP_ORIGIN || process.env.PUBLIC_APP_URL)) ||
  'https://seo-ecommercex.deco.page';

export async function analyzeLinks(url: string): Promise<LinkAnalysisResult> {
  const start = Date.now();
  let html = '';
  let status = 0;
  const notes: string[] = [];
  try {
    const res = await localFetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': `DecoLinkAnalyzer/1.0 (+${APP_ORIGIN}/)` },
    });
    status = res.status;
    if (!res.ok) {
      notes.push(`Fetch status ${res.status}`);
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
    const buf = await res.arrayBuffer();
    const slice = buf.byteLength > 512 * 1024 ? buf.slice(0, 512 * 1024) : buf;
    html = new TextDecoder('utf-8').decode(slice);
    if (buf.byteLength > slice.byteLength) notes.push('HTML truncado a 500KB');
  } catch (e) {
    const err = e as Error;
    notes.push(`Falha no fetch principal: ${err.message}`);
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

  const parsed = parseHtml(html, url);
  const links = parsed.links;
  const {
    internalLinks,
    externalLinks,
    title,
    metaDescription,
    canonical,
    h1Count,
    wordCount,
    images,
    imagesMissingAlt,
  } = parsed;

  // Check up to 40 links for broken status
  const sample = links.slice(0, 40);
  let broken = 0;
  for (const l of sample) {
    const st = await headOrGet(l, 6000);
    if (st === 0 || st >= 400) broken++;
  }

  // Heuristic scoring
  let score = 100;
  if (!title) {
    score -= 10;
    notes.push('Sem <title>');
  }
  if (title.length < 15 || title.length > 65) score -= 5;
  if (!metaDescription) {
    score -= 8;
    notes.push('Sem meta description');
  } else if (metaDescription.length < 50 || metaDescription.length > 165) {
    score -= 4;
  }
  if (h1Count === 0) {
    score -= 6;
    notes.push('Sem H1');
  } else if (h1Count > 2) {
    score -= 4;
    notes.push('H1s excessivos');
  }
  if (imagesMissingAlt > 0) score -= Math.min(10, imagesMissingAlt);
  if (broken > 0) score -= Math.min(20, broken * 2);
  if (wordCount < 200) score -= 6;
  if (internalLinks < 3) score -= 3;
  if (links.length > 300) score -= 5;
  const seoScore = Math.max(0, Math.min(100, score));

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

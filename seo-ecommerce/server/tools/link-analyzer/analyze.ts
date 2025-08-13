// Pure analysis logic kept separate so unit tests avoid importing workers runtime.
export interface LinkAnalysisResult {
  url: string;
  linksFound: number;
  brokenLinks: number;
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
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal });
    if (res.status === 405 || res.status === 501) {
      // Some servers disallow HEAD
      const resGet = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal });
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
  let notes: string[] = [];
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow', headers: { 'User-Agent': 'DecoLinkAnalyzer/1.0 (+https://seo-ecommerce.deco.page/)' } });
    if (!res.ok) {
      notes.push(`Fetch status ${res.status}`);
    } else {
      html = await res.text();
      fetchOk = true;
    }
  } catch (e) {
    notes.push('Falha no fetch principal');
  }
  const base = new URL(url);
  const links = fetchOk ? extractLinks(html, base) : [];
  const sample = links.slice(0, 40); // limit link checking to 40 to stay within worker limits/time
  let broken = 0;
  // Sequential to avoid blowing subrequest limits; could be parallel with Promise.allSettled and chunking.
  for (const l of sample) {
    const status = await headOrGet(l, 6000);
    if (status === 0 || status >= 400) broken++;
  }
  // Simple heuristic SEO score (placeholder): base 100 - penalty
  const penalty = Math.min(60, broken * 2 + Math.max(0, links.length - 200) / 10);
  const seoScore = Math.max(10, 100 - Math.round(penalty));
  if (!fetchOk) {
    // Fallback deterministic stub if we could not fetch
    if (!links.length) {
      return {
        url,
        linksFound: 0,
        brokenLinks: 0,
        seoScore: 50,
        links: [],
        notes: notes.concat('Retorno parcial (stub, fetch falhou)').join('; '),
      };
    }
  }
  if (Date.now() - start > 15000) notes.push('Análise demorou >15s (parcial)');
  return {
    url,
    linksFound: links.length,
    brokenLinks: broken,
    seoScore,
    links,
    notes: notes.length ? notes.join('; ') : undefined,
  };
}
